import { Pause, Play, Repeat, Square } from 'lucide-react'
import { useCallback, useEffect, useRef } from 'react'

import { Slider } from '@/components/ui/Slider'
import WaveformViewer from '@/components/WaveformViewer'
import type { AudioProcessParams } from '@/lib/types'
import { AudioProcessor, getAudioContext } from '@/lib/audio/processor'
import { cn } from '@/lib/utils'
import { useAudioStore } from '@/store/useAudioStore'

/** 将秒数格式化为 mm:ss。 */
function formatTime(seconds: number): string {
  let s = seconds
  if (!Number.isFinite(s) || s < 0) s = 0
  const m = Math.floor(s / 60)
  const sec = Math.floor(s % 60)
  return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`
}

/**
 * 构造旁路参数集：关闭低频增强与压缩器、清零各频段增益，
 * 用于"原始"预览模式，使处理链等价于直通。
 */
function buildBypassParams(params: AudioProcessParams): AudioProcessParams {
  return {
    lowShelf: { ...params.lowShelf, enabled: false },
    equalizer: params.equalizer.map((b) => ({ ...b, gain: 0 })),
    compressor: { ...params.compressor, enabled: false },
  }
}

/**
 * A/B 预览播放器。
 *
 * 持有共享 AudioProcessor 实例，与 store 双向同步：
 * - audioBuffer 变化时重置播放；
 * - params / previewMode 变化时更新处理链（原始模式旁路）；
 * - 播放时以 requestAnimationFrame 实时回写 currentTime。
 */
export default function PreviewPlayer() {
  const audioBuffer = useAudioStore((s) => s.audioBuffer)
  const audioMeta = useAudioStore((s) => s.audioMeta)
  const params = useAudioStore((s) => s.params)
  const playState = useAudioStore((s) => s.playState)
  const currentTime = useAudioStore((s) => s.currentTime)
  const previewMode = useAudioStore((s) => s.previewMode)
  const setPlayState = useAudioStore((s) => s.setPlayState)
  const setCurrentTime = useAudioStore((s) => s.setCurrentTime)
  const togglePreviewMode = useAudioStore((s) => s.togglePreviewMode)

  // 懒初始化 AudioProcessor 单例（基于全局共享 AudioContext）
  const processorRef = useRef<AudioProcessor | null>(null)
  if (processorRef.current === null) {
    const ctx = getAudioContext()
    processorRef.current = new AudioProcessor(ctx)
  }
  const processor = processorRef.current

  const duration = audioMeta?.duration ?? processor.getDuration()

  // 播放自然结束回调
  useEffect(() => {
    processor.onEnded = () => {
      setPlayState('stopped')
      setCurrentTime(0)
    }
  }, [processor, setPlayState, setCurrentTime])

  // 同步 audioBuffer 到 processor
  useEffect(() => {
    if (audioBuffer) {
      processor.setBuffer(audioBuffer)
      setCurrentTime(0)
      setPlayState('stopped')
    }
  }, [audioBuffer, processor, setCurrentTime, setPlayState])

  // 同步处理参数（原始模式旁路所有处理）
  useEffect(() => {
    const applied =
      previewMode === 'original' ? buildBypassParams(params) : params
    processor.updateParams(applied)
  }, [params, previewMode, processor])

  // 实时回写 currentTime（仅播放时）
  useEffect(() => {
    if (playState !== 'playing') return
    let raf = 0
    const tick = () => {
      setCurrentTime(processor.getCurrentTime())
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [playState, processor, setCurrentTime])

  const handlePlayPause = useCallback(() => {
    if (!audioBuffer) return
    if (playState === 'playing') {
      processor.pause()
      setPlayState('paused')
      setCurrentTime(processor.getCurrentTime())
    } else {
      // 浏览器自动暂停策略：播放前恢复 AudioContext
      const ctx = getAudioContext()
      if (ctx.state === 'suspended') {
        void ctx.resume()
      }
      processor.play(currentTime)
      setPlayState('playing')
    }
  }, [
    audioBuffer,
    playState,
    processor,
    currentTime,
    setPlayState,
    setCurrentTime,
  ])

  const handleStop = useCallback(() => {
    processor.stop()
    setPlayState('stopped')
    setCurrentTime(0)
  }, [processor, setPlayState, setCurrentTime])

  const handleSeek = useCallback(
    (time: number) => {
      if (!audioBuffer) return
      const target = Math.max(0, Math.min(time, duration))
      processor.seek(target)
      setCurrentTime(processor.getCurrentTime())
    },
    [audioBuffer, duration, processor, setCurrentTime],
  )

  const handleToggleMode = useCallback(() => {
    const wasPlaying = playState === 'playing'
    const pos = processor.getCurrentTime()
    if (wasPlaying) {
      processor.stop()
    }
    const nextMode = previewMode === 'original' ? 'processed' : 'original'
    // 无缝切换：立即应用下一模式参数再从当前位置续播
    const nextParams =
      nextMode === 'original' ? buildBypassParams(params) : params
    processor.updateParams(nextParams)
    togglePreviewMode()
    if (wasPlaying) {
      processor.play(pos)
      setPlayState('playing')
    }
  }, [
    playState,
    previewMode,
    params,
    processor,
    togglePreviewMode,
    setPlayState,
  ])

  const hasBuffer = Boolean(audioBuffer)
  const isPlaying = playState === 'playing'

  return (
    <section className="flex flex-col gap-4 rounded-lg border border-bass-border bg-bass-surface p-4">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold text-bass-text">预览播放</h2>
        <button
          type="button"
          onClick={handleToggleMode}
          aria-pressed={previewMode === 'processed'}
          aria-label="切换原始与处理后预览"
          className={cn(
            'inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bass-bg',
            previewMode === 'processed'
              ? 'border-accent bg-accent/10 text-accent'
              : 'border-bass-border text-bass-muted hover:text-bass-text',
          )}
        >
          <Repeat className="h-3.5 w-3.5" />
          {previewMode === 'processed' ? '处理后' : '原始'}
        </button>
      </div>

      <WaveformViewer
        audioBuffer={audioBuffer}
        currentTime={currentTime}
        onSeek={hasBuffer ? handleSeek : undefined}
      />

      <Slider
        ariaLabel="播放进度"
        value={Math.min(currentTime, duration)}
        min={0}
        max={duration > 0 ? duration : 1}
        step={0.01}
        disabled={!hasBuffer}
        onChange={(v) => handleSeek(v)}
      />

      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handlePlayPause}
            disabled={!hasBuffer}
            aria-label={isPlaying ? '暂停' : '播放'}
            className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-accent text-bass-bg transition-colors hover:bg-accent-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bass-bg disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isPlaying ? (
              <Pause className="h-5 w-5" />
            ) : (
              <Play className="h-5 w-5 translate-x-0.5" />
            )}
          </button>
          <button
            type="button"
            onClick={handleStop}
            disabled={!hasBuffer}
            aria-label="停止"
            className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-bass-border text-bass-muted transition-colors hover:text-bass-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bass-bg disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Square className="h-4 w-4" />
          </button>
        </div>
        <div className="text-xs tabular-nums text-bass-muted">
          {formatTime(currentTime)} / {formatTime(duration)}
        </div>
      </div>
    </section>
  )
}
