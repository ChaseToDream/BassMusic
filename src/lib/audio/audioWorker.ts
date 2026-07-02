/// <reference lib="webworker" />

/**
 * 音频计算 Worker。
 *
 * 将 computePeaks（波形峰值）与 encodeWav（WAV 编码）移出主线程，
 * 避免长音频处理时阻塞 UI 渲染。通道数据通过 Transferable Objects
 * 传入（零拷贝），计算结果同样 Transfer 回传。
 *
 * 注意：AudioBuffer.getChannelData() 返回的 Float32Array 是
 * AudioBuffer 内存的视图，其底层 ArrayBuffer 无法直接 Transfer。
 * workerClient 在主线程复制为独立 ArrayBuffer 后再 Transfer 传入，
 * 原始 AudioBuffer 数据不受影响。
 */

import { encodeWav } from './encoding/wav'

/* ===== computePeaks ===== */

interface ComputePeaksInput {
  type: 'computePeaks'
  channelBuffers: ArrayBuffer[]
  channelLengths: number[]
  cssWidth: number
}

/**
 * 从 Transfer 传入的 ArrayBuffer 重建 Float32Array 通道数据，
 * 并计算指定宽度下的波形峰值（每像素 min/max）。
 */
function computePeaksFromInput(input: ComputePeaksInput): Float32Array[] {
  const { channelBuffers, cssWidth } = input
  const result: Float32Array[] = []

  for (let ch = 0; ch < channelBuffers.length; ch++) {
    const data = new Float32Array(channelBuffers[ch])
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

/* ===== encodeWav ===== */

interface EncodeWavInput {
  type: 'encodeWav'
  channelBuffers: ArrayBuffer[]
  channelLengths: number[]
  sampleRate: number
  numberOfChannels: number
  length: number
}

/**
 * 从 Transfer 传入的 ArrayBuffer 重建通道数据，
 * 并编码为 16-bit PCM WAV ArrayBuffer。
 */
function encodeWavFromInput(input: EncodeWavInput): ArrayBuffer {
  const { channelBuffers, sampleRate, numberOfChannels, length } = input
  const channels: Float32Array[] = []
  for (let c = 0; c < numberOfChannels; c++) {
    channels.push(new Float32Array(channelBuffers[c]))
  }
  return encodeWav(channels, sampleRate, length)
}

/* ===== Worker 消息处理 ===== */

// Worker 上下文类型声明（避免与 DOM Window 类型冲突）
declare const self: DedicatedWorkerGlobalScope

self.onmessage = (e: MessageEvent) => {
  const data = e.data
  const requestId = data.requestId as number

  if (data.type === 'computePeaks') {
    const peaks = computePeaksFromInput(data as ComputePeaksInput)
    // Transfer 峰值 ArrayBuffer 回传（零拷贝）
    const transferList: Transferable[] = peaks.map((p) => p.buffer as ArrayBuffer)
    self.postMessage({ requestId, type: 'peaks', data: peaks }, { transfer: transferList })
  } else if (data.type === 'encodeWav') {
    const wavBuffer = encodeWavFromInput(data as EncodeWavInput)
    // Transfer WAV ArrayBuffer 回传（零拷贝）
    self.postMessage({ requestId, type: 'wav', data: wavBuffer }, { transfer: [wavBuffer] })
  }
}
