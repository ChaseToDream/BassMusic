/**
 * 音频导出模块。
 *
 * 提供离线渲染（与实时处理链结构一致）、WAV(PCM 16-bit) 编码、
 * MP3(lamejs) 编码、文件下载以及统一的导出入口。
 */
import lamejs from 'lamejs'

import type {
  AudioProcessParams,
  ExportOptions,
} from '../types'
import { buildProcessingChain } from './processor'

/** MP3 分块编码的采样块大小（lamejs 内部一帧为 1152 采样）。 */
const MP3_BLOCK_SIZE = 1152
/** WAV 头部长度（RIFF/fmt/data 子块头部固定 44 字节）。 */
const WAV_HEADER_LENGTH = 44
/** WAV 16-bit 每采样字节数。 */
const BYTES_PER_SAMPLE = 2

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
 * 将字符串写入 DataView（每字符一字节，用于 RIFF 头标识）。
 */
function writeString(view: DataView, offset: number, str: string): void {
  for (let i = 0; i < str.length; i++) {
    view.setUint8(offset + i, str.charCodeAt(i))
  }
}

/**
 * 将 Float32 样本钳制到 [-1, 1] 并转换为 16-bit 有符号整数（小端序由 DataView 写入决定）。
 */
function floatToInt16(sample: number): number {
  const clamped = Math.max(-1, Math.min(1, sample))
  return clamped < 0 ? clamped * 0x8000 : clamped * 0x7fff
}

/**
 * 将 AudioBuffer 编码为 16-bit PCM WAV Blob。
 *
 * 完整 RIFF 结构：'RIFF' / 文件大小 / 'WAVE' / 'fmt '(16 字节, PCM) / 'data'。
 * 支持单声道与立体声，交错写入采样数据。
 *
 * @param buffer - 输入音频缓冲
 * @returns WAV 格式的 Blob
 */
export function encodeWav(buffer: AudioBuffer): Blob {
  const numChannels = buffer.numberOfChannels
  const sampleRate = buffer.sampleRate
  const length = buffer.length
  const blockAlign = numChannels * BYTES_PER_SAMPLE
  const dataSize = length * blockAlign
  const fileSize = WAV_HEADER_LENGTH + dataSize

  const arrayBuffer = new ArrayBuffer(fileSize)
  const view = new DataView(arrayBuffer)

  // RIFF 头
  writeString(view, 0, 'RIFF')
  view.setUint32(4, 36 + dataSize, true) // 文件大小 - 8
  writeString(view, 8, 'WAVE')

  // fmt 子块
  writeString(view, 12, 'fmt ')
  view.setUint32(16, 16, true) // 子块大小
  view.setUint16(20, 1, true) // 音频格式：PCM
  view.setUint16(22, numChannels, true)
  view.setUint32(24, sampleRate, true)
  view.setUint32(28, sampleRate * blockAlign, true) // 字节率
  view.setUint16(32, blockAlign, true)
  view.setUint16(34, 16, true) // 位深

  // data 子块
  writeString(view, 36, 'data')
  view.setUint32(40, dataSize, true)

  // PCM 数据（交错）
  const channels: Float32Array[] = []
  for (let c = 0; c < numChannels; c++) {
    channels.push(buffer.getChannelData(c))
  }
  let offset = WAV_HEADER_LENGTH
  for (let i = 0; i < length; i++) {
    for (let c = 0; c < numChannels; c++) {
      view.setInt16(offset, floatToInt16(channels[c][i]), true)
      offset += BYTES_PER_SAMPLE
    }
  }

  return new Blob([arrayBuffer], { type: 'audio/wav' })
}

/**
 * 将 Float32 通道数据转为 Int16。
 */
function float32ToInt16Array(input: Float32Array): Int16Array {
  const output = new Int16Array(input.length)
  for (let i = 0; i < input.length; i++) {
    output[i] = floatToInt16(input[i])
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
 * 将 AudioBuffer 编码为 MP3 Blob（基于 lamejs）。
 *
 * @param buffer - 输入音频缓冲
 * @param kbps - 比特率，仅支持 128 / 192 / 320
 * @returns MP3 格式的 Blob
 */
export function encodeMp3(buffer: AudioBuffer, kbps: 128 | 192 | 320): Blob {
  const numChannels = Math.min(2, buffer.numberOfChannels)
  const sampleRate = buffer.sampleRate
  const length = buffer.length

  const encoder = new lamejs.Mp3Encoder(numChannels, sampleRate, kbps)

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
    const blob = encodeWav(rendered)
    onProgress?.(0.5)
    onProgress?.(1.0)
    return blob
  }

  // MP3
  const kbps = options.mp3Bitrate ?? 128
  const blob = encodeMp3(rendered, kbps)
  onProgress?.(0.5)
  onProgress?.(0.9)
  onProgress?.(1.0)
  return blob
}
