/**
 * 音频导出模块。
 *
 * 提供离线渲染（与实时处理链结构一致）、WAV(PCM 16-bit) 编码、
 * MP3(lamejs) 编码、文件下载以及统一的导出入口。
 *
 * 性能优化：
 * - WAV 编码通过 Web Worker 异步完成（encodeWavAsync），避免长音频导出阻塞主线程；
 *   encodeWav 同步版本保留导出仅供测试使用。
 * - MP3 编码使用 @breezystack/lamejs（社区维护 fork），通过动态 import()
 *   按需加载——仅在导出 MP3 时才拉取编码器模块，不影响首屏体验。
 */
import type { AudioProcessParams, ExportOptions } from '../types'
import { encodeWavFromBuffer } from './encoding/wav'
import { buildProcessingChain } from './processor'
import { encodeWavAsync } from './workerClient'

/** MP3 分块编码的采样块大小（lamejs 内部一帧为 1152 采样）。 */
const MP3_BLOCK_SIZE = 1152

/**
 * 离线渲染：用 OfflineAudioContext 跑通与实时一致的处理链，
 * 输出处理后的 AudioBuffer。
 *
 * @param buffer - 输入音频缓冲
 * @param params - 处理参数
 * @returns 渲染后的 AudioBuffer
 */
export async function renderOffline(
  buffer: AudioBuffer,
  params: AudioProcessParams,
): Promise<AudioBuffer> {
  const sampleRate = buffer.sampleRate
  const length = buffer.length
  const numberOfChannels = Math.min(2, buffer.numberOfChannels)

  const w = window as unknown as {
    OfflineAudioContext?: typeof OfflineAudioContext
    webkitOfflineAudioContext?: typeof OfflineAudioContext
  }
  const Ctor = w.OfflineAudioContext ?? w.webkitOfflineAudioContext ?? OfflineAudioContext
  const offlineCtx = new Ctor(numberOfChannels, length, sampleRate)

  // 复用共享处理链，保证离线渲染与实时处理参数完全一致
  const chain = buildProcessingChain(offlineCtx, params)
  chain.output.connect(offlineCtx.destination)

  const source = offlineCtx.createBufferSource()
  source.buffer = buffer
  source.connect(chain.input)
  source.start(0)

  return offlineCtx.startRendering()
}

/**
 * 将 AudioBuffer 编码为 16-bit PCM WAV Blob。
 *
 * 底层复用共享 WAV 编码器，与 Web Worker 异步编码保持完全一致。
 *
 * @param buffer - 输入音频缓冲
 * @returns WAV 格式的 Blob
 */
export function encodeWav(buffer: AudioBuffer): Blob {
  return new Blob([encodeWavFromBuffer(buffer)], { type: 'audio/wav' })
}

/**
 * 将 Float32 通道数据转为 Int16。
 */
function float32ToInt16Array(input: Float32Array): Int16Array {
  const output = new Int16Array(input.length)
  for (let i = 0; i < input.length; i++) {
    const clamped = Math.max(-1, Math.min(1, input[i]))
    output[i] = clamped < 0 ? clamped * 0x8000 : clamped * 0x7fff
  }
  return output
}

/** 合并多个 Uint8Array 为单个 ArrayBuffer（便于作为 BlobPart 传入 Blob）。 */
function concatUint8(chunks: Uint8Array[]): ArrayBuffer {
  const total = chunks.reduce((sum, c) => sum + c.length, 0)
  const buffer = new ArrayBuffer(total)
  const view = new Uint8Array(buffer)
  let pos = 0
  for (const c of chunks) {
    view.set(c, pos)
    pos += c.length
  }
  return buffer
}

/**
 * 将 AudioBuffer 编码为 MP3 Blob（基于 lamejs，按需动态加载）。
 *
 * lamejs 约 130KB，仅在导出 MP3 时通过 import() 按需拉取，
 * 不进入首屏包，实现代码分割。
 *
 * @param buffer - 输入音频缓冲
 * @param kbps - 比特率，仅支持 128 / 192 / 320
 * @returns MP3 格式的 Blob
 */
export async function encodeMp3(
  buffer: AudioBuffer,
  kbps: 128 | 192 | 320,
): Promise<Blob> {
  const { Mp3Encoder } = await import('@breezystack/lamejs')
  const numChannels = Math.min(2, buffer.numberOfChannels)
  const sampleRate = buffer.sampleRate
  const length = buffer.length

  const encoder = new Mp3Encoder(numChannels, sampleRate, kbps)

  const left = float32ToInt16Array(buffer.getChannelData(0))
  const right =
    numChannels > 1 ? float32ToInt16Array(buffer.getChannelData(1)) : undefined

  const chunks: Uint8Array[] = []
  for (let i = 0; i < length; i += MP3_BLOCK_SIZE) {
    const end = Math.min(i + MP3_BLOCK_SIZE, length)
    const leftChunk = left.subarray(i, end)
    const rightChunk = right ? right.subarray(i, end) : undefined
    const encoded = rightChunk
      ? encoder.encodeBuffer(leftChunk, rightChunk)
      : encoder.encodeBuffer(leftChunk)
    if (encoded.length > 0) {
      chunks.push(encoded)
    }
  }

  const flush = encoder.flush()
  if (flush.length > 0) {
    chunks.push(flush)
  }

  const result = concatUint8(chunks)
  return new Blob([result], { type: 'audio/mpeg' })
}

/**
 * 触发浏览器下载给定的 Blob。
 *
 * 通过 createObjectURL 生成临时链接，构造隐藏 `<a>` 并触发 click，
 * 下载后立即 revokeObjectURL 释放内存。
 *
 * @param blob - 待下载的数据
 * @param filename - 保存的文件名
 */
export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.style.display = 'none'
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

/**
 * 统一导出入口：离线渲染 → 按格式编码。
 *
 * 进度回调区间：
 * - 渲染完成：0.1
 * - WAV：0.5 → 1.0
 * - MP3：0.5 → 0.9 → 1.0
 *
 * @param buffer - 输入音频缓冲
 * @param params - 处理参数
 * @param options - 导出选项（格式 / 比特率）
 * @param onProgress - 可选的进度回调（0-1）
 * @returns 编码后的 Blob
 */
export async function exportAudio(
  buffer: AudioBuffer,
  params: AudioProcessParams,
  options: ExportOptions,
  onProgress?: (progress: number) => void,
): Promise<Blob> {
  const rendered = await renderOffline(buffer, params)
  onProgress?.(0.1)

  if (options.format === 'wav') {
    const blob = await encodeWavAsync(rendered)
    onProgress?.(0.5)
    onProgress?.(1.0)
    return blob
  }

  // MP3（lamejs 按需动态加载）
  const kbps = options.mp3Bitrate ?? 128
  const blob = await encodeMp3(rendered, kbps)
  onProgress?.(0.5)
  onProgress?.(0.9)
  onProgress?.(1.0)
  return blob
}
