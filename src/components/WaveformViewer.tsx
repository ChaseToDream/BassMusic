import {
  useCallback,
  useEffect,
  useRef,
  type KeyboardEvent,
  type MouseEvent,
} from 'react'

import { cn } from '@/lib/utils'

export interface WaveformViewerProps {
  /** 待绘制的音频缓冲；为 null 时显示空状态 */
  audioBuffer: AudioBuffer | null
  /** 当前播放进度（秒） */
  currentTime: number
  /** 跳转回调（点击/键盘跳转时触发） */
  onSeek?: (time: number) => void
  className?: string
}

const ACCENT = '#facc15'
const MUTED = '#8a94a8'
const MONO_HEIGHT = 160
const STEREO_HEIGHT = 200

/**
 * 绘制波形到指定 canvas。
 *
 * 算法：按每像素一组聚合采样，计算该组 min/max 作为竖线绘制；
 * 多声道分通道上下排列，中心线为 0 振幅。
 * 已播放部分（x <= progressX）使用 accent 色，未播放使用 muted 色。
 */
function drawWaveform(
  canvas: HTMLCanvasElement,
  audioBuffer: AudioBuffer | null,
  currentTime: number,
): void {
  const cssWidth = canvas.clientWidth
  if (cssWidth <= 0) return

  const dpr = window.devicePixelRatio || 1
  const isStereo = audioBuffer ? audioBuffer.numberOfChannels >= 2 : false
  const cssHeight = isStereo ? STEREO_HEIGHT : MONO_HEIGHT

  // 同步像素分辨率（按设备像素比放大，避免模糊）
  const pixelWidth = Math.max(1, Math.round(cssWidth * dpr))
  const pixelHeight = Math.max(1, Math.round(cssHeight * dpr))
  if (canvas.width !== pixelWidth || canvas.height !== pixelHeight) {
    canvas.width = pixelWidth
    canvas.height = pixelHeight
  }

  const ctx = canvas.getContext('2d')
  if (!ctx) return
  ctx.setTransform(1, 0, 0, 1, 0, 0)
  ctx.scale(dpr, dpr)
  ctx.clearRect(0, 0, cssWidth, cssHeight)

  // 背景
  ctx.fillStyle = 'rgba(11,16,32,0.5)'
  ctx.fillRect(0, 0, cssWidth, cssHeight)

  if (!audioBuffer) {
    return
  }

  const duration = audioBuffer.duration
  const progressX = duration > 0 ? (currentTime / duration) * cssWidth : 0
  const drawChannels = Math.min(2, audioBuffer.numberOfChannels)
  const channelHeight = cssHeight / drawChannels

  for (let ch = 0; ch < drawChannels; ch++) {
    const data = audioBuffer.getChannelData(ch)
    const samplesPerPixel = Math.max(1, Math.floor(data.length / cssWidth))
    const top = ch * channelHeight
    const mid = top + channelHeight / 2
    const half = channelHeight / 2

    for (let x = 0; x < cssWidth; x++) {
      const start = x * samplesPerPixel
      const end = Math.min(start + samplesPerPixel, data.length)
      let min = 1
      let max = -1
      for (let i = start; i < end; i++) {
        const v = data[i]
        if (v < min) min = v
        if (v > max) max = v
      }
      if (end <= start) {
        min = 0
        max = 0
      }
      const played = x <= progressX
      ctx.fillStyle = played ? ACCENT : MUTED
      const yTop = mid - max * half
      const yBottom = mid - min * half
      const h = Math.max(1, yBottom - yTop)
      ctx.fillRect(x, yTop, 1, h)
    }
  }

  // 进度指示线
  if (progressX > 0 && progressX <= cssWidth) {
    ctx.fillStyle = ACCENT
    ctx.fillRect(progressX - 1, 0, 2, cssHeight)
  }
}

/**
 * 波形查看器：基于 Canvas 绘制音频波形与播放进度，
 * 支持点击与键盘跳转，自适应容器宽度。
 */
export default function WaveformViewer({
  audioBuffer,
  currentTime,
  onSeek,
  className,
}: WaveformViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)

  const draw = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    drawWaveform(canvas, audioBuffer, currentTime)
  }, [audioBuffer, currentTime])

  // buffer / currentTime 变化时重绘
  useEffect(() => {
    draw()
  }, [draw])

  // 容器尺寸变化时重绘（用 ref 避免每次 draw 变化重新订阅）
  const drawRef = useRef(draw)
  drawRef.current = draw
  useEffect(() => {
    const container = containerRef.current
    if (!container || typeof ResizeObserver === 'undefined') return
    const ro = new ResizeObserver(() => {
      drawRef.current()
    })
    ro.observe(container)
    return () => ro.disconnect()
  }, [])

  const seekFromClientX = useCallback(
    (clientX: number) => {
      const canvas = canvasRef.current
      if (!canvas || !audioBuffer || !onSeek) return
      const rect = canvas.getBoundingClientRect()
      const ratio = rect.width > 0 ? (clientX - rect.left) / rect.width : 0
      const clamped = Math.max(0, Math.min(1, ratio))
      onSeek(clamped * audioBuffer.duration)
    },
    [audioBuffer, onSeek],
  )

  const handleClick = (e: MouseEvent<HTMLCanvasElement>) => {
    seekFromClientX(e.clientX)
  }

  const handleKeyDown = (e: KeyboardEvent<HTMLCanvasElement>) => {
    if (!audioBuffer || !onSeek) return
    const duration = audioBuffer.duration
    if (e.key === 'ArrowLeft') {
      e.preventDefault()
      onSeek(Math.max(0, currentTime - 1))
    } else if (e.key === 'ArrowRight') {
      e.preventDefault()
      onSeek(Math.min(duration, currentTime + 1))
    }
  }

  const duration = audioBuffer?.duration ?? 0
  const isStereo = audioBuffer ? audioBuffer.numberOfChannels >= 2 : false

  return (
    <div ref={containerRef} className={cn('relative w-full', className)}>
      <canvas
        ref={canvasRef}
        role="slider"
        aria-label="播放进度"
        aria-valuemin={0}
        aria-valuemax={duration}
        aria-valuenow={currentTime}
        aria-valuetext={`${currentTime.toFixed(1)} / ${duration.toFixed(1)} 秒`}
        tabIndex={0}
        onClick={handleClick}
        onKeyDown={handleKeyDown}
        className={cn(
          'block w-full cursor-pointer rounded-md border border-bass-border bg-bass-bg/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bass-bg',
          isStereo ? 'h-[200px]' : 'h-[160px]',
        )}
      />
      {!audioBuffer && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <span className="text-sm text-bass-muted">请先上传音频文件</span>
        </div>
      )}
    </div>
  )
}
