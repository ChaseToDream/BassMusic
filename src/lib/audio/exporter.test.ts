/**
 * exporter 模块单元测试。
 *
 * 限制说明：
 * - encodeWav 在 jsdom 中可真实运行（仅依赖 ArrayBuffer/DataView/Blob/URL）。
 * - encodeMp3 依赖 @breezystack/lamejs：虽为 ESM 包可直接 import，但为验证 encodeMp3
 *   的分块、合并与 flush 逻辑（而非 lamejs 编码正确性），仍用 vi.mock 替换为固定
 *   字节输出，使断言可预测。
 * - renderOffline / exportAudio 依赖 OfflineAudioContext，此处通过 vi.stubGlobal
 *   注入一个最小 mock（以普通 function 实现，支持 new 调用）进行验证。
 * - exportAudio 中的 WAV 编码现走 Web Worker（encodeWavAsync），此处 mock workerClient
 *   使测试在 jsdom 中可运行；encodeWav 同步版本仍可直接测试。
 */
import { describe, it, expect, afterEach, vi } from 'vitest'

// mock @breezystack/lamejs
vi.mock('@breezystack/lamejs', () => {
  class MockMp3Encoder {
    encodeBuffer(): Uint8Array {
      return new Uint8Array([1, 2])
    }
    flush(): Uint8Array {
      return new Uint8Array([3])
    }
  }
  return {
    Mp3Encoder: MockMp3Encoder,
  }
})

// mock workerClient：encodeWavAsync 直接调用同步 encodeWav 实现，
// 使 exportAudio 测试在 jsdom（无 Worker）中可运行。
vi.mock('@/lib/audio/workerClient', () => ({
  encodeWavAsync: vi.fn(async (buffer: AudioBuffer) => {
    // 直接调用 exporter 模块内的同步 encodeWav（通过动态 import 获取）
    const { encodeWav } = await import('./exporter')
    return encodeWav(buffer)
  }),
}))

import {
  encodeWav,
  encodeMp3,
  downloadBlob,
  renderOffline,
  exportAudio,
} from './exporter'
import { DEFAULT_AUDIO_PROCESS_PARAMS } from '../types'

/* ===== 手工 Mock ===== */

class MockParam {
  value = 0
}

/** 通用处理链节点 mock（覆盖 buildProcessingChain 用到的全部 AudioParam）。 */
class MockChainNode {
  type = 'allpass'
  frequency = new MockParam()
  gain = new MockParam()
  Q = new MockParam()
  threshold = new MockParam()
  ratio = new MockParam()
  attack = new MockParam()
  release = new MockParam()
  readonly connections: unknown[] = []
  connect<T>(target: T): T {
    this.connections.push(target)
    return target
  }
  disconnect(): void {
    this.connections.length = 0
  }
}

interface MockAudioBufferOptions {
  length?: number
  sampleRate?: number
  numberOfChannels?: number
  duration?: number
}

class MockAudioBuffer {
  readonly length: number
  readonly sampleRate: number
  readonly numberOfChannels: number
  readonly duration: number
  private readonly channelData: Float32Array[]

  constructor(opts: MockAudioBufferOptions = {}) {
    this.length = opts.length ?? 100
    this.sampleRate = opts.sampleRate ?? 44100
    this.numberOfChannels = opts.numberOfChannels ?? 1
    this.duration = opts.duration ?? this.length / this.sampleRate
    this.channelData = []
    for (let c = 0; c < this.numberOfChannels; c++) {
      this.channelData.push(new Float32Array(this.length))
    }
  }

  getChannelData(channel: number): Float32Array {
    return this.channelData[channel] ?? new Float32Array(this.length)
  }
}

/**
 * 构造一个可被 new 调用的 mock OfflineAudioContext 构造函数。
 * 实现使用普通 function 以支持 `new Ctor(...)`，并记录调用参数。
 */
function createMockOfflineContext(renderedBuffer: unknown) {
  const startRendering = vi.fn().mockResolvedValue(renderedBuffer)
  const OfflineCtor = vi.fn(function (this: Record<string, unknown>) {
    this.destination = new MockChainNode()
    this.createBiquadFilter = () => new MockChainNode()
    this.createDynamicsCompressor = () => new MockChainNode()
    this.createGain = () => new MockChainNode()
    this.createBufferSource = () => ({
      buffer: null,
      onended: null,
      connect: vi.fn(),
      start: vi.fn(),
      stop: vi.fn(),
    })
    this.startRendering = startRendering
  })
  return { OfflineCtor, startRendering }
}

/** 读取 DataView 指定位置的 ASCII 字符串。 */
function readString(view: DataView, offset: number, length: number): string {
  let str = ''
  for (let i = 0; i < length; i++) {
    str += String.fromCharCode(view.getUint8(offset + i))
  }
  return str
}

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

/* ===== 测试用例 ===== */

describe('exporter', () => {
  describe('encodeWav', () => {
    it('生成大于 44 字节的 Blob，且包含正确的 RIFF 头', async () => {
      const buffer = new MockAudioBuffer({
        length: 100,
        sampleRate: 44100,
        numberOfChannels: 2,
      })
      const blob = encodeWav(buffer as unknown as AudioBuffer)

      // 44 头 + 100 帧 * 2 通道 * 2 字节 = 444
      expect(blob.size).toBe(44 + 100 * 2 * 2)
      expect(blob.size).toBeGreaterThan(44)
      expect(blob.type).toBe('audio/wav')

      const ab = await blob.arrayBuffer()
      const view = new DataView(ab)
      expect(readString(view, 0, 4)).toBe('RIFF')
      expect(readString(view, 8, 4)).toBe('WAVE')
      expect(readString(view, 12, 4)).toBe('fmt ')
      expect(readString(view, 36, 4)).toBe('data')
      // 文件大小字段 = 文件总长 - 8
      expect(view.getUint32(4, true)).toBe(44 + 100 * 2 * 2 - 8)
    })

    it('RIFF 头部字段（采样率/声道/位深/字节率/块对齐）正确', async () => {
      const buffer = new MockAudioBuffer({
        length: 50,
        sampleRate: 48000,
        numberOfChannels: 1,
      })
      const blob = encodeWav(buffer as unknown as AudioBuffer)
      const view = new DataView(await blob.arrayBuffer())

      expect(view.getUint16(20, true)).toBe(1) // PCM
      expect(view.getUint16(22, true)).toBe(1) // 单声道
      expect(view.getUint32(24, true)).toBe(48000) // 采样率
      expect(view.getUint16(32, true)).toBe(2) // 块对齐 = 1*2
      expect(view.getUint16(34, true)).toBe(16) // 位深
      expect(view.getUint32(28, true)).toBe(48000 * 2) // 字节率
      expect(view.getUint32(40, true)).toBe(50 * 1 * 2) // data 大小
    })

    it('立体声数据按交错顺序写入', async () => {
      const buffer = new MockAudioBuffer({
        length: 3,
        sampleRate: 44100,
        numberOfChannels: 2,
      })
      // 设置可辨识的样本：L=[0.5, 0.25, 0.125], R=[-0.5, -0.25, -0.125]
      const left = buffer.getChannelData(0)
      const right = buffer.getChannelData(1)
      left[0] = 0.5
      left[1] = 0.25
      left[2] = 0.125
      right[0] = -0.5
      right[1] = -0.25
      right[2] = -0.125

      const view = new DataView(
        await encodeWav(buffer as unknown as AudioBuffer).arrayBuffer(),
      )
      const expectedL = [0.5 * 0x7fff, 0.25 * 0x7fff, 0.125 * 0x7fff]
      const expectedR = [-0.5 * 0x8000, -0.25 * 0x8000, -0.125 * 0x8000]

      for (let i = 0; i < 3; i++) {
        expect(view.getInt16(44 + i * 4, true)).toBeCloseTo(expectedL[i], -1)
        expect(view.getInt16(46 + i * 4, true)).toBeCloseTo(expectedR[i], -1)
      }
    })
  })

  describe('encodeMp3', () => {
    // @breezystack/lamejs 为 ESM 包可直接运行，但为验证 encodeMp3 的分块编码与合并逻辑，
    // 此处仍通过 vi.mock 替换为固定字节输出，使断言可预测。
    // encodeMp3 现为 async（动态 import lamejs），所有断言需 await。
    it('单声道：按 1152 采样分块编码并合并 flush 结果', async () => {
      const buffer = new MockAudioBuffer({
        length: 2304, // 恰好 2 个 1152 块
        sampleRate: 44100,
        numberOfChannels: 1,
      })
      const blob = await encodeMp3(buffer as unknown as AudioBuffer, 128)
      expect(blob.type).toBe('audio/mpeg')
      // 2 块 * 2 字节 + flush 1 字节 = 5
      expect(blob.size).toBe(2 * 2 + 1)
    })

    it('立体声：使用双声道编码', async () => {
      const buffer = new MockAudioBuffer({
        length: 1152, // 1 个块
        sampleRate: 44100,
        numberOfChannels: 2,
      })
      const blob = await encodeMp3(buffer as unknown as AudioBuffer, 192)
      expect(blob.type).toBe('audio/mpeg')
      // 1 块 * 2 字节 + flush 1 字节 = 3
      expect(blob.size).toBe(2 + 1)
    })

    it('非整块长度：末尾不足 1152 也能编码', async () => {
      const buffer = new MockAudioBuffer({
        length: 1500, // 1 整块 1152 + 1 块 348
        sampleRate: 44100,
        numberOfChannels: 1,
      })
      const blob = await encodeMp3(buffer as unknown as AudioBuffer, 320)
      expect(blob.type).toBe('audio/mpeg')
      // 2 块 * 2 字节 + flush 1 字节 = 5
      expect(blob.size).toBe(2 * 2 + 1)
    })
  })

  describe('downloadBlob', () => {
    it('创建对象 URL、触发 click 并释放 URL', () => {
      const createObjectURL = vi
        .spyOn(URL, 'createObjectURL')
        .mockReturnValue('blob:fake-url')
      const revokeObjectURL = vi
        .spyOn(URL, 'revokeObjectURL')
        .mockImplementation(() => {})

      const clickSpy = vi.fn()
      const fakeAnchor = {
        href: '',
        download: '',
        style: { display: '' },
        click: clickSpy,
      }
      vi.spyOn(document, 'createElement').mockReturnValue(
        fakeAnchor as unknown as HTMLAnchorElement,
      )
      const appendChildSpy = vi
        .spyOn(document.body, 'appendChild')
        .mockImplementation(() => null as unknown as ChildNode)
      const removeChildSpy = vi
        .spyOn(document.body, 'removeChild')
        .mockImplementation(() => null as unknown as ChildNode)

      downloadBlob(new Blob(['x']), 'output.wav')

      expect(createObjectURL).toHaveBeenCalledTimes(1)
      expect(fakeAnchor.href).toBe('blob:fake-url')
      expect(fakeAnchor.download).toBe('output.wav')
      expect(appendChildSpy).toHaveBeenCalledWith(fakeAnchor)
      expect(clickSpy).toHaveBeenCalledTimes(1)
      expect(removeChildSpy).toHaveBeenCalledWith(fakeAnchor)
      expect(revokeObjectURL).toHaveBeenCalledWith('blob:fake-url')
    })
  })

  describe('renderOffline', () => {
    it('使用 OfflineAudioContext 渲染并返回 startRendering 结果', async () => {
      const renderedBuffer = new MockAudioBuffer({
        length: 10,
        sampleRate: 44100,
        numberOfChannels: 1,
      })
      const { OfflineCtor, startRendering } = createMockOfflineContext(renderedBuffer)
      vi.stubGlobal('OfflineAudioContext', OfflineCtor)

      const inputBuffer = new MockAudioBuffer({
        length: 10,
        sampleRate: 44100,
        numberOfChannels: 1,
      })
      const result = await renderOffline(
        inputBuffer as unknown as AudioBuffer,
        DEFAULT_AUDIO_PROCESS_PARAMS,
      )

      // 构造签名：(numberOfChannels, length, sampleRate)
      expect(OfflineCtor).toHaveBeenCalledWith(1, 10, 44100)
      expect(startRendering).toHaveBeenCalledTimes(1)
      expect(result).toBe(renderedBuffer)
    })
  })

  describe('exportAudio', () => {
    it('wav 格式：触发进度回调 0.1→0.5→1.0 并返回 WAV Blob', async () => {
      const renderedBuffer = new MockAudioBuffer({
        length: 100,
        sampleRate: 44100,
        numberOfChannels: 2,
      })
      const { OfflineCtor } = createMockOfflineContext(renderedBuffer)
      vi.stubGlobal('OfflineAudioContext', OfflineCtor)

      const inputBuffer = new MockAudioBuffer({
        length: 100,
        sampleRate: 44100,
        numberOfChannels: 2,
      })
      const progress: number[] = []
      const blob = await exportAudio(
        inputBuffer as unknown as AudioBuffer,
        DEFAULT_AUDIO_PROCESS_PARAMS,
        { format: 'wav' },
        (p) => progress.push(p),
      )

      expect(blob.type).toBe('audio/wav')
      expect(progress).toEqual([0.1, 0.5, 1.0])
    })

    it('mp3 格式：触发进度回调 0.1→0.5→0.9→1.0 并返回 MP3 Blob', async () => {
      const length = 1152
      const renderedBuffer = new MockAudioBuffer({
        length,
        sampleRate: 44100,
        numberOfChannels: 1,
      })
      const { OfflineCtor } = createMockOfflineContext(renderedBuffer)
      vi.stubGlobal('OfflineAudioContext', OfflineCtor)

      const inputBuffer = new MockAudioBuffer({
        length,
        sampleRate: 44100,
        numberOfChannels: 1,
      })
      const progress: number[] = []
      const blob = await exportAudio(
        inputBuffer as unknown as AudioBuffer,
        DEFAULT_AUDIO_PROCESS_PARAMS,
        { format: 'mp3', mp3Bitrate: 128 },
        (p) => progress.push(p),
      )

      expect(blob.type).toBe('audio/mpeg')
      expect(blob.size).toBeGreaterThan(0)
      expect(progress).toEqual([0.1, 0.5, 0.9, 1.0])
    })
  })
})
