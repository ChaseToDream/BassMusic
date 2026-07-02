/**
 * workerClient 模块测试。
 *
 * 验证 Worker 消息通信的正确性：
 * - computePeaksAsync 发送正确消息格式
 * - encodeWavAsync 发送正确消息格式
 * - Worker 回传数据后正确解析为 Float32Array[] / Blob
 *
 * Worker 在 jsdom 中不可用，通过 vi.stubGlobal('Worker') mock。
 * workerClient 内部使用单例 Worker，测试间需 vi.resetModules 重置模块状态。
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

/** 构造 AudioBuffer 桩。 */
function makeBufferStub(length = 44100, numberOfChannels = 2): AudioBuffer {
  const channelData: Float32Array[] = []
  for (let c = 0; c < numberOfChannels; c++) {
    const data = new Float32Array(length)
    for (let i = 0; i < length; i++) {
      data[i] = ((i % 100) / 100) * (c === 0 ? 1 : -1)
    }
    channelData.push(data)
  }

  return {
    length,
    duration: length / 44100,
    sampleRate: 44100,
    numberOfChannels,
    getChannelData: (channel: number) => channelData[channel] ?? new Float32Array(0),
  } as unknown as AudioBuffer
}

describe('workerClient', () => {
  /** Mock Worker 实例，供测试检查 postMessage 调用并模拟回传。 */
  let mockInstance: {
    onmessage: ((e: MessageEvent) => void) | null
    postMessage: ReturnType<typeof vi.fn>
  }

  beforeEach(() => {
    // 每个测试重置模块缓存，确保 workerClient 重新初始化单例 Worker
    vi.resetModules()

    // stub Worker 构造函数：每次 new Worker(...) 返回同一个 mock 实例
    mockInstance = { onmessage: null, postMessage: vi.fn() }
    vi.stubGlobal(
      'Worker',
      class {
        onmessage: ((e: MessageEvent) => void) | null = null
        postMessage = mockInstance.postMessage
        constructor() {
          // 每个 new 都更新 mockInstance 的 onmessage 引用
          mockInstance.onmessage = this.onmessage
          // 同时更新 this.onmessage 让 client 设置的 handler 能被 mockInstance 访问
          this.onmessage = null
          // 延迟绑定：client 在 new 之后设置 onmessage，
          // 所以需要让 mockInstance.onmessage 指向实际实例的 onmessage
          Object.defineProperty(mockInstance, 'onmessage', {
            get: () => this.onmessage,
            set: (v) => {
              this.onmessage = v
            },
            configurable: true,
          })
        }
      },
    )
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  /** 模拟 Worker 回传消息。 */
  function simulateWorkerResponse(data: unknown): void {
    if (mockInstance.onmessage) {
      mockInstance.onmessage(new MessageEvent('message', { data }))
    }
  }

  describe('computePeaksAsync', () => {
    it('发送 computePeaks 消息并接收峰值数据', async () => {
      // 动态 import 以触发 vi.resetModules 后的重初始化
      const { computePeaksAsync } = await import('./workerClient')

      const buffer = makeBufferStub(44100, 1)
      const cssWidth = 600

      const promise = computePeaksAsync(buffer, cssWidth)

      // 验证发送的消息格式
      expect(mockInstance.postMessage).toHaveBeenCalledTimes(1)
      const call = mockInstance.postMessage.mock.calls[0]
      const message = call[0]
      expect(message.type).toBe('computePeaks')
      expect(message.cssWidth).toBe(600)
      expect(message.channelBuffers.length).toBe(1)
      expect(message.channelLengths.length).toBe(1)

      // 模拟 Worker 回传峰值数据
      const peaks = new Float32Array(cssWidth * 2)
      simulateWorkerResponse({ requestId: message.requestId, type: 'peaks', data: [peaks] })

      const result = await promise
      expect(result).toBeDefined()
      expect(result.length).toBe(1)
      expect(result[0].length).toBe(cssWidth * 2)
    })

    it('立体声发送 2 个通道数据', async () => {
      const { computePeaksAsync } = await import('./workerClient')

      const buffer = makeBufferStub(44100, 2)
      const cssWidth = 800

      const promise = computePeaksAsync(buffer, cssWidth)

      const message = mockInstance.postMessage.mock.calls[0][0]
      expect(message.channelBuffers.length).toBe(2)
      expect(message.channelLengths.length).toBe(2)

      const peaks0 = new Float32Array(cssWidth * 2)
      const peaks1 = new Float32Array(cssWidth * 2)
      simulateWorkerResponse({ requestId: message.requestId, type: 'peaks', data: [peaks0, peaks1] })

      const result = await promise
      expect(result.length).toBe(2)
    })
  })

  describe('encodeWavAsync', () => {
    it('发送 encodeWav 消息并接收 WAV Blob', async () => {
      const { encodeWavAsync } = await import('./workerClient')

      const buffer = makeBufferStub(100, 1)

      const promise = encodeWavAsync(buffer)

      expect(mockInstance.postMessage).toHaveBeenCalledTimes(1)
      const message = mockInstance.postMessage.mock.calls[0][0]
      expect(message.type).toBe('encodeWav')
      expect(message.sampleRate).toBe(44100)
      expect(message.numberOfChannels).toBe(1)
      expect(message.length).toBe(100)
      expect(message.channelBuffers.length).toBe(1)

      // 44 header + 100 samples * 1 channel * 2 bytes = 244 bytes
      const wavBuffer = new ArrayBuffer(244)
      simulateWorkerResponse({ requestId: message.requestId, type: 'wav', data: wavBuffer })

      const result = await promise
      expect(result).toBeInstanceOf(Blob)
      expect(result.type).toBe('audio/wav')
      expect(result.size).toBe(244)
    })
  })
})
