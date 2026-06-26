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
 * 峰值缓存：按 CSS 像素宽度聚合的每像素 min/max 采样值。
 * 每个通道存为一个 Float32Array，长度为 cssWidth*2，按 [min0,max0,min1,max1,...] 交错排列。
 */
interface PeaksCache {
  /** 缓存对应的音频缓冲引用，用于检测是否失效。 */
  buffer: AudioBuffer | null
  /** 缓存对应的 CSS 像素宽度，用于检测尺寸变化后失效。 */
  cssWidth: number
  /** 各通道的峰值数据（null 表示无音频缓冲）。 */
  data: Float32Array[] | null
}

/**
 * 计算指定宽度下的波形峰值数据。
 *
 * 算法：按每像素一组聚合采样，计算该组 min/max。
 * 这是最耗时的部分（需遍历全部采样），因此结果会被缓存，
 * 仅在 buffer 引用或容器宽度变化时重新计算。
 */
function computePeaks(
  audioBuffer: AudioBuffer,
  cssWidth: number,
): Float32Array[] {
  const channels = Math.min(2, audioBuffer.numberOfChannels)
  const result: Float32Array[] = []
  for (let ch = 0; ch < channels; ch++) {
    const data = audioBuffer.getChannelData(ch)
    const samplesPerPixel = Math.max(1, Math.floor(data.length / cssWidth))
    const peaks = new Float32Array(cssWidth * 2)
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
      peaks[x * 2] = min
      peaks[x * 2 + 1] = max
    }
    result.push(peaks)
  }
  return result
}

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
  // 峰值缓存：buffer 引用或 cssWidth 变化时才重新计算
  const peaksCacheRef = useRef<PeaksCache>({
    buffer: null,
    cssWidth: 0,
    data: null,
  })

  /**
   * 确保 peaks 缓存与当前 buffer / 容器宽度匹配，失效时重新计算。
   * 返回当前有效的峰值数据（无音频时为 null）。
   */
  const ensurePeaks = useCallback(
    (cssWidth: number): Float32Array[] | null => {
      const cache = peaksCacheRef.current
      if (
        cache.buffer === audioBuffer &&
        cache.cssWidth === cssWidth &&
        (cache.data !== null || audioBuffer === null)
      ) {
        return cache.data
      }
      const data = audioBuffer ? computePeaks(audioBuffer, cssWidth) : null
      peaksCacheRef.current = { buffer: audioBuffer, cssWidth, data }
      return data
    },
    [audioBuffer],
  )

  const draw = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const cssWidth = canvas.clientWidth
    const peaks = ensurePeaks(cssWidth)
    const duration = audioBuffer?.duration ?? 0
    drawFromPeaks(canvas, peaks, currentTime, duration)
  }, [audioBuffer, currentTime, ensurePeaks])

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
