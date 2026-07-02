/**
 * A/B 预览播放器。
 *
 * 作为 audioService 与 store 之间的唯一同步点：
 * - 订阅 store 中播放相关字段，通过 effect 将 buffer/params 同步到 audioService；
 * - 用户交互（play/pause/stop/seek）调用 audioService 后由本组件回写 store；
 * - 通过 audioService.onEnded 订阅播放结束事件，同步 store 状态。
 *
 * 原始模式通过 buildBypassParams 构造旁路参数，实现等效直通预览。
 */
import { Pause, Play, Repeat, Square } from 'lucide-react'
import { useCallback, useEffect } from 'react'

import { Slider } from '@/components/ui/Slider'
import WaveformViewer from '@/components/WaveformViewer'
import { audioService } from '@/lib/audio/audioService'
import { buildBypassParams } from '@/lib/audio/params'
import { formatSeconds } from '@/lib/format'
import { FOCUS_RING } from '@/lib/styles'
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
  const setPlayState = useAudioStore((s) => s.setPlayState)
  const togglePreviewMode = useAudioStore((s) => s.togglePreviewMode)

  const duration = audioMeta?.duration ?? audioService.getDuration()

  // 订阅播放结束事件：audioService 不再直接写 store，由本回调同步
  useEffect(() => {
    audioService.onEnded = () => {
      setPlayState('stopped')
      setCurrentTime(0)
    }
    return () => {
      audioService.onEnded = null
    }
  }, [setPlayState, setCurrentTime])

  // 同步音频缓冲到 audioService（store 的 setAudioFile 已重置 playState/currentTime）
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
  // 节流到每 100ms 更新一次 store，将重渲染频率从 60fps 降到 10fps，
  // 对时间显示与进度条而言足够流畅，同时大幅减少无关重渲染
  useEffect(() => {
    if (playState !== 'playing') return
    let raf = 0
    let lastUpdate = 0
    const tick = (now: number) => {
      if (now - lastUpdate >= 100) {
        setCurrentTime(audioService.getCurrentTime())
        lastUpdate = now
      }
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [playState, setCurrentTime])

  const handlePlayPause = useCallback(() => {
    if (!audioBuffer) return
    if (playState === 'playing') {
      const pos = audioService.pause()
      setPlayState('paused')
      setCurrentTime(pos)
    } else {
      audioService.play(currentTime)
      setPlayState('playing')
    }
  }, [audioBuffer, playState, currentTime, setPlayState, setCurrentTime])

  const handleStop = useCallback(() => {
    audioService.stop()
    setPlayState('stopped')
    setCurrentTime(0)
  }, [setPlayState, setCurrentTime])

  const handleSeek = useCallback(
    (time: number) => {
      if (!audioBuffer) return
      const target = Math.max(0, Math.min(time, duration))
      const pos = audioService.seek(target)
      setCurrentTime(pos)
    },
    [audioBuffer, duration, setCurrentTime],
  )

  const handleToggleMode = useCallback(() => {
    const wasPlaying = playState === 'playing'
    const pos = audioService.getCurrentTime()
    if (wasPlaying) {
      audioService.stop()
      setPlayState('stopped')
    }
    // 切换模式前手动应用参数，避免 effect 延迟导致 play 时使用旧参数
    const nextMode = previewMode === 'original' ? 'processed' : 'original'
    const nextParams = nextMode === 'original' ? buildBypassParams(params) : params
    audioService.updateParams(nextParams)
    togglePreviewMode()
    if (wasPlaying) {
      audioService.play(pos)
      setPlayState('playing')
    }
  }, [playState, previewMode, params, togglePreviewMode, setPlayState])

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
            'inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs font-medium transition-colors',
            FOCUS_RING,
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
            className={cn(
              'inline-flex h-10 w-10 items-center justify-center rounded-full bg-accent text-bass-bg transition-colors hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-50',
              FOCUS_RING,
            )}
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
            className={cn(
              'inline-flex h-9 w-9 items-center justify-center rounded-md border border-bass-border text-bass-muted transition-colors hover:text-bass-text disabled:cursor-not-allowed disabled:opacity-50',
              FOCUS_RING,
            )}
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
