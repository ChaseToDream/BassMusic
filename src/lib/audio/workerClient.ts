/**
 * Web Worker 客户端包装器。
 *
 * 管理 audioWorker 的生命周期（懒初始化、单例复用），提供异步 API
 * 供 WaveformViewer（computePeaks）和 exporter（encodeWav）调用。
 *
 * 通道数据复制策略：
 * - AudioBuffer.getChannelData() 返回的 Float32Array 是 AudioBuffer 内存的视图，
 *   其底层 ArrayBuffer 无法直接 Transfer（AudioBuffer 拥有该内存）。
 * - 此处将通道数据复制到独立 ArrayBuffer-backed Float32Array，再 Transfer 给 Worker，
 *   原始 AudioBuffer 数据不受影响。
 * - Worker 计算结果通过 Transferable 回传（零拷贝）。
 *
 * 并发安全：
 * - 每次请求分配唯一 requestId，onmessage 按 requestId 分发给对应 Promise，
 *   避免并发调用时后一个回调覆盖前一个导致 Promise 永远无法 resolve。
 */

/** Worker 实例（懒初始化单例）。 */
let worker: Worker | null = null

let requestIdCounter = 0

/** 获取 Worker 单例，首次调用时创建。 */
function getWorker(): Worker {
  if (!worker) {
    worker = new Worker(new URL('./audioWorker.ts', import.meta.url), { type: 'module' })
  }
  return worker
}

/**
 * 将 AudioBuffer 通道数据复制到独立 ArrayBuffer-backed Float32Array，
 * 返回 ArrayBuffer 数组（用于 Transfer）与原始长度数组。
 */
function copyChannelData(
  audioBuffer: AudioBuffer,
  maxChannels: number,
): { buffers: ArrayBuffer[]; lengths: number[] } {
  const channels = Math.min(maxChannels, audioBuffer.numberOfChannels)
  const buffers: ArrayBuffer[] = []
  const lengths: number[] = []
  for (let ch = 0; ch < channels; ch++) {
    const src = audioBuffer.getChannelData(ch)
    const copy = new Float32Array(src.length)
    copy.set(src)
    buffers.push(copy.buffer)
    lengths.push(src.length)
  }
  return { buffers, lengths }
}

/** Worker 请求类型。 */
type WorkerRequestType = 'computePeaks' | 'encodeWav'
/** Worker 响应类型。 */
type WorkerResponseType = 'peaks' | 'wav'

/** 按 requestId 存储的待处理请求映射。 */
const pendingRequests = new Map<
  number,
  { resolve: (value: unknown) => void; responseType: WorkerResponseType }
>()

/** 安装单一的消息分发处理器。 */
function installMessageHandler(w: Worker): void {
  w.onmessage = (e: MessageEvent) => {
    const { requestId, type, data } = e.data as { requestId: number; type: string; data: unknown }
    const pending = pendingRequests.get(requestId)
    if (!pending) return
    if (pending.responseType === type) {
      pendingRequests.delete(requestId)
      pending.resolve(data)
    }
  }
}

/**
 * 发送一条带 requestId 的请求给 Worker，并返回 Promise 等待对应响应。
 */
function postRequest<T>(
  requestType: WorkerRequestType,
  responseType: WorkerResponseType,
  payload: Record<string, unknown>,
  transferList: ArrayBuffer[],
): Promise<T> {
  const w = getWorker()
  if (w.onmessage === null) {
    installMessageHandler(w)
  }

  const requestId = ++requestIdCounter
  return new Promise<T>((resolve) => {
    pendingRequests.set(requestId, {
      resolve: resolve as (value: unknown) => void,
      responseType,
    })
    w.postMessage({ requestId, type: requestType, ...payload }, transferList as unknown as Transferable[])
  })
}

/**
 * 在 Worker 中异步计算波形峰值数据。
 *
 * @param audioBuffer - 输入音频缓冲
 * @param cssWidth - CSS 像素宽度
 * @returns 各通道的 Float32Array 峰值数据（长度 cssWidth*2，[min,max,...] 交错）
 */
export async function computePeaksAsync(
  audioBuffer: AudioBuffer,
  cssWidth: number,
): Promise<Float32Array[]> {
  const { buffers, lengths } = copyChannelData(audioBuffer, 2)

  return postRequest<Float32Array[]>('computePeaks', 'peaks', { channelBuffers: buffers, channelLengths: lengths, cssWidth }, buffers)
}

/**
 * 在 Worker 中异步编码 WAV。
 *
 * @param audioBuffer - 输入音频缓冲
 * @returns WAV 格式的 Blob
 */
export async function encodeWavAsync(audioBuffer: AudioBuffer): Promise<Blob> {
  const numChannels = audioBuffer.numberOfChannels
  const sampleRate = audioBuffer.sampleRate
  const length = audioBuffer.length
  const { buffers, lengths } = copyChannelData(audioBuffer, numChannels)

  const arrayBuffer = await postRequest<ArrayBuffer>('encodeWav', 'wav', {
    channelBuffers: buffers,
    channelLengths: lengths,
    sampleRate,
    numberOfChannels: numChannels,
    length,
  }, buffers)

  return new Blob([arrayBuffer], { type: 'audio/wav' })
}
