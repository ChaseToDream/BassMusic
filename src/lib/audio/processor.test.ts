/**
 * AudioProcessor 单元测试。
 *
 * 限制说明：jsdom 不提供 Web Audio API，且引入 web-audio-test-mock
 * 会增加配置复杂度，因此本文件手工实现一个最小的 mock AudioContext
 * 与节点对象（仅覆盖 AudioProcessor 用到的 API：节点创建、AudioParam.value、
 * connect、source.start/stop/onended）。时间推进通过手动设置 currentTime 模拟。
 */
import { describe, it, expect, beforeEach } from 'vitest'

import { AudioProcessor, buildProcessingChain } from './processor'
import { DEFAULT_AUDIO_PROCESS_PARAMS } from '../types'
import type { AudioProcessParams } from '../types'

/* ===== 手工 Mock Web Audio API ===== */

class MockAudioParam {
  value = 0
  defaultValue = 0
  setValueAtTime(): this {
    return this
  }
  linearRampToValueAtTime(): this {
    return this
  }
  exponentialRampToValueAtTime(): this {
    return this
  }
  cancelScheduledValues(): this {
    return this
  }
}

class MockAudioNode {
  readonly connections: MockAudioNode[] = []
  connect<T extends MockAudioNode>(target: T): T {
    this.connections.push(target)
    return target
  }
  disconnect(): void {
    this.connections.length = 0
  }
}

class MockBiquadFilterNode extends MockAudioNode {
  type: BiquadFilterType = 'allpass'
  readonly frequency = new MockAudioParam()
  readonly gain = new MockAudioParam()
  readonly Q = new MockAudioParam()
  readonly detune = new MockAudioParam()
}

class MockDynamicsCompressorNode extends MockAudioNode {
  readonly threshold = new MockAudioParam()
  readonly knee = new MockAudioParam()
  readonly ratio = new MockAudioParam()
  readonly attack = new MockAudioParam()
  readonly release = new MockAudioParam()
  reduction = 0
}

class MockGainNode extends MockAudioNode {
  readonly gain = new MockAudioParam()
}

class MockAudioBufferSourceNode extends MockAudioNode {
  buffer: unknown = null
  onended: (() => void) | null = null
  loop = false
  loopStart = 0
  loopEnd = 0
  readonly playbackRate = new MockAudioParam()
  readonly detune = new MockAudioParam()
  startArgs: { when: number; offset: number } | undefined
  private started = false

  start(when = 0, offset = 0): void {
    this.started = true
    this.startArgs = { when, offset }
  }

  stop(): void {
    this.started = false
  }

  /** 测试辅助：模拟 source 自然结束触发 onended。 */
  simulateEnded(): void {
    this.onended?.()
  }

  isStarted(): boolean {
    return this.started
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

class MockAudioContext {
  currentTime = 0
  state: AudioContextState = 'running'
  readonly sampleRate = 44100
  readonly destination = new MockGainNode()

  readonly biquadFilters: MockBiquadFilterNode[] = []
  readonly dynamicsCompressors: MockDynamicsCompressorNode[] = []
  readonly gainNodes: MockGainNode[] = []
  readonly sources: MockAudioBufferSourceNode[] = []

  createBiquadFilter(): MockBiquadFilterNode {
    const node = new MockBiquadFilterNode()
    this.biquadFilters.push(node)
    return node
  }

  createDynamicsCompressor(): MockDynamicsCompressorNode {
    const node = new MockDynamicsCompressorNode()
    this.dynamicsCompressors.push(node)
    return node
  }

  createGain(): MockGainNode {
    const node = new MockGainNode()
    this.gainNodes.push(node)
    return node
  }

  createBufferSource(): MockAudioBufferSourceNode {
    const node = new MockAudioBufferSourceNode()
    this.sources.push(node)
    return node
  }

  get lastSource(): MockAudioBufferSourceNode | undefined {
    return this.sources[this.sources.length - 1]
  }

  resume(): Promise<void> {
    return Promise.resolve()
  }
  suspend(): Promise<void> {
    return Promise.resolve()
  }
  close(): Promise<void> {
    return Promise.resolve()
  }
}

/* ===== 测试用例 ===== */

describe('AudioProcessor', () => {
  let ctx: MockAudioContext
  let processor: AudioProcessor

  beforeEach(() => {
    ctx = new MockAudioContext()
    processor = new AudioProcessor(ctx as unknown as AudioContext)
  })

  describe('构造与处理链', () => {
    it('创建正确数量的节点：1 LowShelf + 5 EQ + 1 Compressor + 1 Gain', () => {
      const lowShelfCount = ctx.biquadFilters.filter((b) => b.type === 'lowshelf').length
      const peakingCount = ctx.biquadFilters.filter((b) => b.type === 'peaking').length
      expect(lowShelfCount).toBe(1)
      expect(peakingCount).toBe(5)
      expect(ctx.dynamicsCompressors).toHaveLength(1)
      expect(ctx.gainNodes).toHaveLength(1)
    })

    it('处理链节点按正确顺序连接', () => {
      const lowShelf = ctx.biquadFilters[0]
      const bands = ctx.biquadFilters.slice(1)
      const compressor = ctx.dynamicsCompressors[0]
      const makeupGain = ctx.gainNodes[0]

      expect(lowShelf.connections).toContain(bands[0])
      expect(bands[0].connections).toContain(bands[1])
      expect(bands[3].connections).toContain(bands[4])
      expect(bands[4].connections).toContain(compressor)
      expect(compressor.connections).toContain(makeupGain)
      expect(makeupGain.connections).toContain(ctx.destination)
    })

    it('用默认参数初始化 LowShelf', () => {
      const lowShelf = ctx.biquadFilters[0]
      expect(lowShelf.type).toBe('lowshelf')
      expect(lowShelf.frequency.value).toBe(
        DEFAULT_AUDIO_PROCESS_PARAMS.lowShelf.frequency,
      )
      expect(lowShelf.gain.value).toBe(DEFAULT_AUDIO_PROCESS_PARAMS.lowShelf.gain)
    })

    it('buildProcessingChain 独立构建时同样创建 5 个 peaking 频段', () => {
      ctx = new MockAudioContext()
      const chain = buildProcessingChain(
        ctx as unknown as AudioContext,
        DEFAULT_AUDIO_PROCESS_PARAMS,
      )
      expect(chain.bands).toHaveLength(5)
      expect(chain.input).toBe(chain.lowShelf)
      expect(chain.output).toBe(chain.makeupGain)
      chain.bands.forEach((band) => {
        expect(band.type).toBe('peaking')
      })
    })
  })

  describe('updateLowShelf', () => {
    it('开启时正确设置 frequency 与 gain', () => {
      processor.updateLowShelf({ enabled: true, frequency: 120, gain: 8 })
      const lowShelf = ctx.biquadFilters[0]
      expect(lowShelf.frequency.value).toBe(120)
      expect(lowShelf.gain.value).toBe(8)
    })

    it('关闭时增益置 0（旁路）', () => {
      processor.updateLowShelf({ enabled: false, frequency: 120, gain: 8 })
      const lowShelf = ctx.biquadFilters[0]
      expect(lowShelf.frequency.value).toBe(120)
      expect(lowShelf.gain.value).toBe(0)
    })
  })

  describe('updateEqualizerBand', () => {
    it('更新对应频段的 frequency/gain/Q', () => {
      processor.updateEqualizerBand(2, {
        id: 2,
        frequency: 2000,
        gain: 5,
        q: 2,
      })
      const peakingBands = ctx.biquadFilters.filter((b) => b.type === 'peaking')
      expect(peakingBands[2].frequency.value).toBe(2000)
      expect(peakingBands[2].gain.value).toBe(5)
      expect(peakingBands[2].Q.value).toBe(2)
    })

    it('不影响其它频段', () => {
      processor.updateEqualizerBand(0, {
        id: 0,
        frequency: 150,
        gain: -3,
        q: 1.5,
      })
      const peakingBands = ctx.biquadFilters.filter((b) => b.type === 'peaking')
      expect(peakingBands[1].gain.value).toBe(0)
      expect(peakingBands[4].gain.value).toBe(0)
    })

    it('越界索引被忽略', () => {
      const before = ctx.biquadFilters.map((b) => b.frequency.value)
      processor.updateEqualizerBand(99, {
        id: 99,
        frequency: 9999,
        gain: 10,
        q: 5,
      })
      const after = ctx.biquadFilters.map((b) => b.frequency.value)
      expect(after).toEqual(before)
    })
  })

  describe('updateCompressor', () => {
    it('enabled=false 时正确旁路（threshold=0, ratio=1, makeupGain=0）', () => {
      processor.updateCompressor({
        enabled: false,
        threshold: -24,
        ratio: 4,
        attack: 0.003,
        release: 0.25,
        makeupGain: 3,
      })
      const compressor = ctx.dynamicsCompressors[0]
      const makeup = ctx.gainNodes[0]
      expect(compressor.threshold.value).toBe(0)
      expect(compressor.ratio.value).toBe(1)
      expect(makeup.gain.value).toBe(0)
    })

    it('enabled=true 时正确设置各参数与 makeupGain', () => {
      processor.updateCompressor({
        enabled: true,
        threshold: -20,
        ratio: 6,
        attack: 0.005,
        release: 0.2,
        makeupGain: 4,
      })
      const compressor = ctx.dynamicsCompressors[0]
      const makeup = ctx.gainNodes[0]
      expect(compressor.threshold.value).toBe(-20)
      expect(compressor.ratio.value).toBe(6)
      expect(compressor.attack.value).toBe(0.005)
      expect(compressor.release.value).toBe(0.2)
      expect(makeup.gain.value).toBe(4)
    })
  })

  describe('updateParams', () => {
    it('一次性更新全部参数', () => {
      const params: AudioProcessParams = {
        lowShelf: { enabled: true, frequency: 100, gain: 9 },
        equalizer: [
          { id: 0, frequency: 80, gain: 1, q: 1 },
          { id: 1, frequency: 250, gain: 2, q: 1 },
          { id: 2, frequency: 1000, gain: 3, q: 1 },
          { id: 3, frequency: 4000, gain: -1, q: 1 },
          { id: 4, frequency: 12000, gain: -2, q: 1 },
        ],
        compressor: {
          enabled: true,
          threshold: -18,
          ratio: 8,
          attack: 0.002,
          release: 0.3,
          makeupGain: 5,
        },
      }
      processor.updateParams(params)

      const lowShelf = ctx.biquadFilters[0]
      const peakingBands = ctx.biquadFilters.filter((b) => b.type === 'peaking')
      const compressor = ctx.dynamicsCompressors[0]
      const makeup = ctx.gainNodes[0]

      expect(lowShelf.frequency.value).toBe(100)
      expect(lowShelf.gain.value).toBe(9)
      expect(peakingBands[4].frequency.value).toBe(12000)
      expect(peakingBands[4].gain.value).toBe(-2)
      expect(compressor.ratio.value).toBe(8)
      expect(makeup.gain.value).toBe(5)
    })
  })

  describe('播放控制', () => {
    const makeBuffer = () =>
      new MockAudioBuffer({
        length: 44100,
        sampleRate: 44100,
        numberOfChannels: 2,
      })

    it('play/stop 状态切换正确', () => {
      processor.setBuffer(makeBuffer() as unknown as AudioBuffer)
      expect(processor.isPlaying()).toBe(false)

      processor.play()
      expect(processor.isPlaying()).toBe(true)

      processor.stop()
      expect(processor.isPlaying()).toBe(false)
    })

    it('play 时创建 source 并连接到处理链入口', () => {
      processor.setBuffer(makeBuffer() as unknown as AudioBuffer)
      processor.play()
      const source = ctx.lastSource
      expect(source).toBeDefined()
      expect(source!.isStarted()).toBe(true)
      expect(source!.startArgs?.offset).toBe(0)
      // source 应连接到 LowShelf（处理链入口）
      expect(source!.connections).toContain(ctx.biquadFilters[0])
    })

    it('play 带偏移时 start 传入正确 offset', () => {
      processor.setBuffer(makeBuffer() as unknown as AudioBuffer)
      processor.play(0.5)
      expect(ctx.lastSource!.startArgs?.offset).toBe(0.5)
    })

    it('重复 play 会先停止旧 source', () => {
      processor.setBuffer(makeBuffer() as unknown as AudioBuffer)
      processor.play()
      const first = ctx.lastSource
      processor.play()
      const second = ctx.lastSource
      expect(first).not.toBe(second)
      expect(first!.isStarted()).toBe(false)
    })

    it('stop 不触发 onEnded 回调', () => {
      const buffer = makeBuffer()
      processor.setBuffer(buffer as unknown as AudioBuffer)
      let ended = 0
      processor.onEnded = () => {
        ended += 1
      }
      processor.play()
      processor.stop()
      expect(ended).toBe(0)
    })

    it('自然结束时触发 onEnded 并重置状态', () => {
      const buffer = makeBuffer()
      processor.setBuffer(buffer as unknown as AudioBuffer)
      let ended = 0
      processor.onEnded = () => {
        ended += 1
      }
      processor.play()
      ctx.lastSource!.simulateEnded()
      expect(ended).toBe(1)
      expect(processor.isPlaying()).toBe(false)
    })

    it('getCurrentTime 播放中按 currentTime 计算，停止后保持最后位置', () => {
      const buffer = makeBuffer() // duration = 1s
      processor.setBuffer(buffer as unknown as AudioBuffer)

      ctx.currentTime = 10
      processor.play(0) // startTime = 10
      ctx.currentTime = 10.4
      expect(processor.getCurrentTime()).toBeCloseTo(0.4, 5)

      processor.stop()
      ctx.currentTime = 20
      expect(processor.getCurrentTime()).toBeCloseTo(0.4, 5)
    })

    it('pause 记录位置后停止', () => {
      const buffer = makeBuffer()
      processor.setBuffer(buffer as unknown as AudioBuffer)
      ctx.currentTime = 0
      processor.play(0)
      ctx.currentTime = 0.3
      processor.pause()
      expect(processor.isPlaying()).toBe(false)
      expect(processor.getCurrentTime()).toBeCloseTo(0.3, 5)
    })

    it('seek 在播放时跳转后继续播放', () => {
      const buffer = makeBuffer()
      processor.setBuffer(buffer as unknown as AudioBuffer)
      ctx.currentTime = 0
      processor.play(0)
      const beforeSource = ctx.lastSource
      processor.seek(0.6)
      expect(processor.isPlaying()).toBe(true)
      expect(ctx.lastSource).not.toBe(beforeSource)
      expect(ctx.lastSource!.startArgs?.offset).toBe(0.6)
    })

    it('seek 在停止时仅更新位置', () => {
      const buffer = makeBuffer()
      processor.setBuffer(buffer as unknown as AudioBuffer)
      processor.seek(0.7)
      expect(processor.isPlaying()).toBe(false)
      expect(processor.getCurrentTime()).toBeCloseTo(0.7, 5)
    })

    it('getDuration 返回缓冲时长，未设置缓冲时为 0', () => {
      expect(processor.getDuration()).toBe(0)
      processor.setBuffer(makeBuffer() as unknown as AudioBuffer)
      expect(processor.getDuration()).toBeCloseTo(1, 5)
    })
  })
})
