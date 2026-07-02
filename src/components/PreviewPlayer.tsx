/**
 * A/B 预览播放器。
 *
 * 通过 audioService 统一控制播放与参数更新，自身仅负责 UI 渲染与
 * 播放进度动画同步。原始模式通过 buildBypassParams 构造旁路参数，
 * 实现等效直通预览。
 */
import { Pause, Play, Repeat, Square } from 'lucide-react'
import { useCallback, useEffect } from 'react'

import { Slider } from '@/components/ui/Slider'
import WaveformViewer from '@/components/WaveformViewer'
import { audioService } from '@/lib/audio/audioService'
import { buildBypassParams } from '@/lib/audio/params'
import { formatSeconds } from '@/lib/format'
import { cn } from '@/lib/utils'
import { useAudioStore } from '@/store/useAudioStore'

/**
 * A/B 预览播放器组件。
 *
 * 订阅 store 中播放相关字段，并通过 audioService 同步到底层音频引擎。
 */
export default function PreviewPlayer() {
  const audioBuffer = useAudioStore((s) => s.audioBuffer)
  const audioMeta = useAudioStore((s) => s.audioMeta)
  const params = useAudioStore((s) => s.params)
  const playState = useAudioStore((s) => s.playState)
  const currentTime = useAudioStore((s) => s.currentTime)
  const previewMode = useAudioStore((s) => s.previewMode)
  const setCurrentTime = useAudioStore((s) => s.setCurrentTime)
  const togglePreviewMode = useAudioStore((s) => s.togglePreviewMode)

  const duration = audioMeta?.duration ?? audioService.getDuration()

  // 同步音频缓冲到 audioService
  useEffect(() => {
    if (audioBuffer) {
      audioService.setBuffer(audioBuffer)
    }
  }, [audioBuffer])

  // 同步处理参数（原始模式旁路所有处理）
  useEffect(() => {
    const applied = previewMode === 'original' ? buildBypassParams(params) : params
    audioService.updateParams(applied)
  }, [params, previewMode])

  // 实时回写 currentTime（仅播放时）
  useEffect(() => {
    if (playState !== 'playing') return
    let raf = 0
    const tick = () => {
      setCurrentTime(audioService.getCurrentTime())
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [playState, setCurrentTime])

  const handlePlayPause = useCallback(() => {
    if (!audioBuffer) return
    if (playState === 'playing') {
      audioService.pause()
    } else {
      audioService.play(currentTime)
    }
  }, [audioBuffer, playState, currentTime])

  const handleStop = useCallback(() => {
    audioService.stop()
  }, [])

  const handleSeek = useCallback(
    (time: number) => {
      if (!audioBuffer) return
      const target = Math.max(0, Math.min(time, duration))
      audioService.seek(target)
      setCurrentTime(audioService.getCurrentTime())
    },
    [audioBuffer, duration, setCurrentTime],
  )

  const handleToggleMode = useCallback(() => {
    const wasPlaying = playState === 'playing'
    const pos = audioService.getCurrentTime()
    if (wasPlaying) {
      audioService.stop()
    }
    const nextMode = previewMode === 'original' ? 'processed' : 'original'
    const nextParams = nextMode === 'original' ? buildBypassParams(params) : params
    audioService.updateParams(nextParams)
    togglePreviewMode()
    if (wasPlaying) {
      audioService.play(pos)
    }
  }, [playState, previewMode, params, togglePreviewMode])

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
          {formatSeconds(currentTime)} / {formatSeconds(duration)}
        </div>
      </div>
    </section>
  )
}
