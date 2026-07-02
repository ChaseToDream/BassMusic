/**
 * 共享 WAV 编码器。
 *
 * 提供 16-bit PCM WAV 编码核心逻辑，供主线程同步导出与 Web Worker
 * 异步导出共用，避免两处重复实现。
 */

/** WAV 头部长度（RIFF/fmt/data 子块头部固定 44 字节）。 */
export const WAV_HEADER_LENGTH = 44
/** WAV 16-bit 每采样字节数。 */
export const BYTES_PER_SAMPLE = 2

/** 将字符串写入 DataView（每字符一字节）。 */
export function writeString(view: DataView, offset: number, str: string): void {
  for (let i = 0; i < str.length; i++) {
    view.setUint8(offset + i, str.charCodeAt(i))
  }
}

/** 将 Float32 样本钳制到 [-1, 1] 并转换为 16-bit 有符号整数。 */
export function floatToInt16(sample: number): number {
  const clamped = Math.max(-1, Math.min(1, sample))
  return clamped < 0 ? clamped * 0x8000 : clamped * 0x7fff
}

/**
 * 将交错或分通道的 Float32 样本编码为 16-bit PCM WAV ArrayBuffer。
 *
 * @param channels - 各通道采样数据数组
 * @param sampleRate - 采样率（Hz）
 * @param length - 总采样帧数（每通道）
 * @returns 完整 WAV 文件数据的 ArrayBuffer
 */
export function encodeWav(channels: Float32Array[], sampleRate: number, length: number): ArrayBuffer {
  const numberOfChannels = channels.length
  const blockAlign = numberOfChannels * BYTES_PER_SAMPLE
  const dataSize = length * blockAlign
  const fileSize = WAV_HEADER_LENGTH + dataSize

  const arrayBuffer = new ArrayBuffer(fileSize)
  const view = new DataView(arrayBuffer)

  // RIFF 头
  writeString(view, 0, 'RIFF')
  view.setUint32(4, 36 + dataSize, true)
  writeString(view, 8, 'WAVE')

  // fmt 子块
  writeString(view, 12, 'fmt ')
  view.setUint32(16, 16, true)
  view.setUint16(20, 1, true)
  view.setUint16(22, numberOfChannels, true)
  view.setUint32(24, sampleRate, true)
  view.setUint32(28, sampleRate * blockAlign, true)
  view.setUint16(32, blockAlign, true)
  view.setUint16(34, 16, true)

  // data 子块
  writeString(view, 36, 'data')
  view.setUint32(40, dataSize, true)

  // 交错写入 PCM
  let offset = WAV_HEADER_LENGTH
  for (let i = 0; i < length; i++) {
    for (let c = 0; c < numberOfChannels; c++) {
      view.setInt16(offset, floatToInt16(channels[c][i]), true)
      offset += BYTES_PER_SAMPLE
    }
  }

  return arrayBuffer
}

/**
 * 从 AudioBuffer 编码为 WAV ArrayBuffer。
 *
 * @param buffer - 输入音频缓冲
 * @returns 完整 WAV 文件数据的 ArrayBuffer
 */
export function encodeWavFromBuffer(buffer: AudioBuffer): ArrayBuffer {
  const channels: Float32Array[] = []
  for (let c = 0; c < buffer.numberOfChannels; c++) {
    channels.push(buffer.getChannelData(c))
  }
  return encodeWav(channels, buffer.sampleRate, buffer.length)
}
