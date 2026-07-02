import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type MouseEvent,
} from 'react'

import { computePeaksAsync } from '@/lib/audio/workerClient'
import { CANVAS_COLORS, FOCUS_RING } from '@/lib/styles'
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

const MONO_HEIGHT = 160
const STEREO_HEIGHT = 200

/**
 * 基于缓存的峰值数据绘制波形到指定 canvas。
 *
 * 仅做 fillRect 绘制（每像素一条竖线），无采样遍历，单帧成本与采样数无关。
 * 已播放部分（x <= progressX）使用 accent 色，未播放使用 muted 色。
 */
function drawFromPeaks(
  canvas: HTMLCanvasElement,
  peaks: Float32Array[] | null,
  currentTime: number,
  duration: number,
): void {
  const cssWidth = canvas.clientWidth
  if (cssWidth <= 0) return

  const dpr = window.devicePixelRatio || 1
  const isStereo = peaks ? peaks.length >= 2 : false
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

  if (!peaks) {
    return
  }

  const progressX = duration > 0 ? (currentTime / duration) * cssWidth : 0
  const drawChannels = peaks.length
  const channelHeight = cssHeight / drawChannels

  for (let ch = 0; ch < drawChannels; ch++) {
    const channelPeaks = peaks[ch]
    const top = ch * channelHeight
    const mid = top + channelHeight / 2
    const half = channelHeight / 2

    for (let x = 0; x < cssWidth; x++) {
      const min = channelPeaks[x * 2]
      const max = channelPeaks[x * 2 + 1]
      const played = x <= progressX
      ctx.fillStyle = played ? CANVAS_COLORS.accent : CANVAS_COLORS.muted
      const yTop = mid - max * half
      const yBottom = mid - min * half
      const h = Math.max(1, yBottom - yTop)
      ctx.fillRect(x, yTop, 1, h)
    }
  }

  // 进度指示线
  if (progressX > 0 && progressX <= cssWidth) {
    ctx.fillStyle = CANVAS_COLORS.accent
    ctx.fillRect(progressX - 1, 0, 2, cssHeight)
  }
}

/**
 * 波形查看器：基于 Canvas 绘制音频波形与播放进度，
 * 支持点击与键盘跳转，自适应容器宽度。
 *
 * 性能优化：峰值数据（每像素 min/max）按 buffer 引用与容器宽度缓存，
 * 播放期间每帧仅从缓存读取并 fillRect 重绘进度颜色分区，
 * 不再重复遍历采样数据，避免长音频拖慢渲染。
 */
export default function WaveformViewer({
  audioBuffer,
  currentTime,
  onSeek,
  className,
}: WaveformViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)

  // 峰值数据通过 Worker 异步计算，存入 state 触发重绘
  const [peaksData, setPeaksData] = useState<Float32Array[] | null>(null)
  // 记录当前峰值对应的 buffer 引用和 cssWidth，用于判断是否需要重新计算
  const peaksBufferRef = useRef<AudioBuffer | null>(null)
  const peaksWidthRef = useRef<number>(0)

  // audioBuffer 或容器宽度变化时，异步计算峰值
  useEffect(() => {
    if (!audioBuffer) {
      setPeaksData(null)
      peaksBufferRef.current = null
      peaksWidthRef.current = 0
      return
    }

    // 获取当前容器宽度
    const canvas = canvasRef.current
    if (!canvas) return
    const cssWidth = canvas.clientWidth
    if (cssWidth <= 0) return

    // 缓存命中：buffer 引用与宽度均匹配，无需重新计算
    if (peaksBufferRef.current === audioBuffer && peaksWidthRef.current === cssWidth) {
      return
    }

    // 异步计算峰值（Worker 线程，不阻塞主线程）
    peaksBufferRef.current = audioBuffer
    peaksWidthRef.current = cssWidth
    computePeaksAsync(audioBuffer, cssWidth).then((peaks) => {
      // 检查回调是否仍然对应当前 buffer（避免 stale update）
      if (peaksBufferRef.current === audioBuffer && peaksWidthRef.current === cssWidth) {
        setPeaksData(peaks)
      }
    })
  }, [audioBuffer])

  // 绘制波形：从缓存峰值数据绘制，无采样遍历
  const draw = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const duration = audioBuffer?.duration ?? 0
    drawFromPeaks(canvas, peaksData, currentTime, duration)
  }, [audioBuffer, currentTime, peaksData])

  // draw 的 ref 版本，供 ResizeObserver 等不触发 state 变化的场景使用
  const drawRef = useRef(draw)
  drawRef.current = draw

  // peaksData / currentTime 变化时重绘
  useEffect(() => {
    draw()
  }, [draw])

  // 容器尺寸变化时：宽度变了需异步重算峰值，否则仅重绘
  useEffect(() => {
    const container = containerRef.current
    if (!container || typeof ResizeObserver === 'undefined') return
    const ro = new ResizeObserver(() => {
      const canvas = canvasRef.current
      if (!canvas) return
      const newWidth = canvas.clientWidth
      if (audioBuffer && newWidth > 0 && newWidth !== peaksWidthRef.current) {
        // 宽度变化 → 异步重算峰值
        peaksWidthRef.current = newWidth
        computePeaksAsync(audioBuffer, newWidth).then((peaks) => {
          if (
            peaksBufferRef.current === audioBuffer &&
            peaksWidthRef.current === newWidth
          ) {
            setPeaksData(peaks)
          }
        })
      } else {
        // 仅重绘（currentTime 变化等）
        drawRef.current()
      }
    })
    ro.observe(container)
    return () => ro.disconnect()
  }, [audioBuffer])

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
          'block w-full cursor-pointer rounded-md border border-bass-border bg-bass-bg/40',
          FOCUS_RING,
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
