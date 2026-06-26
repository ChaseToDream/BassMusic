/**
 * 音频处理引擎。
 *
 * 基于 Web Audio API 构建实时处理链：
 *   AudioBufferSourceNode → BiquadFilter(LowShelf) → BiquadFilter(Peaking)×5
 *   → DynamicsCompressor → Gain(MakeUp) → destination
 *
 * 同时导出共享的 `buildProcessingChain`，供离线渲染（exporter）复用，
 * 保证实时处理与离线导出的音频处理参数完全一致。
 */
import { DEFAULT_AUDIO_PROCESS_PARAMS } from '../types'
import type {
  AudioProcessParams,
  CompressorParams,
  EqualizerBand,
  LowShelfParams,
} from '../types'

/** 处理链构建结果：包含入口、出口以及内部各节点引用。 */
export interface ProcessingChain {
  /** 处理链入口（LowShelf 滤波器），source 应连接到此节点。 */
  input: BiquadFilterNode
  /** 处理链出口（MakeUp 增益节点），应连接到 destination。 */
  output: GainNode
  /** LowShelf 滤波器节点。 */
  lowShelf: BiquadFilterNode
  /** 5 段 Peaking 均衡器节点。 */
  bands: BiquadFilterNode[]
  /** 动态压缩器节点。 */
  compressor: DynamicsCompressorNode
  /** MakeUp 增益节点。 */
  makeupGain: GainNode
}

/** 均衡器频段数量。 */
const EQUALIZER_BAND_COUNT = 5

/**
 * 设置 LowShelf 滤波器参数。
 * 关闭时将增益置 0，等价于旁路（仍保留节点连接，避免重连爆音）。
 */
function applyLowShelfParams(
  lowShelf: BiquadFilterNode,
  params: LowShelfParams,
): void {
  lowShelf.frequency.value = params.frequency
  lowShelf.gain.value = params.enabled ? params.gain : 0
}

/**
 * 设置单个 Peaking 均衡器频段参数。
 */
function applyEqualizerBandParams(
  band: BiquadFilterNode,
  bandParams: EqualizerBand,
): void {
  band.frequency.value = bandParams.frequency
  band.gain.value = bandParams.gain
  band.Q.value = bandParams.q
}

/**
 * 设置动态压缩器与 MakeUp 增益参数。
 * 关闭时将 threshold 置 0、ratio 置 1、makeupGain 置 0，等价于旁路。
 */
function applyCompressorParams(
  compressor: DynamicsCompressorNode,
  makeupGain: GainNode,
  params: CompressorParams,
): void {
  if (!params.enabled) {
    compressor.threshold.value = 0
    compressor.ratio.value = 1
    makeupGain.gain.value = 0
    return
  }
  compressor.threshold.value = params.threshold
  compressor.ratio.value = params.ratio
  compressor.attack.value = params.attack
  compressor.release.value = params.release
  makeupGain.gain.value = params.makeupGain
}

/**
 * 将一整套处理参数应用到已构建的处理链节点上。
 */
function applyAllParams(
  chain: Pick<
    ProcessingChain,
    'lowShelf' | 'bands' | 'compressor' | 'makeupGain'
  >,
  params: AudioProcessParams,
): void {
  applyLowShelfParams(chain.lowShelf, params.lowShelf)
  params.equalizer.forEach((band, index) => {
    if (index < chain.bands.length) {
      applyEqualizerBandParams(chain.bands[index], band)
    }
  })
  applyCompressorParams(chain.compressor, chain.makeupGain, params.compressor)
}

/**
 * 构建音频处理链（实时与离线共用）。
 *
 * 创建 LowShelf → EQ×5 → Compressor → MakeUp 的节点序列并完成内部连接，
 * 随后用 `params` 初始化所有节点参数。该函数不连接到 destination，
 * 由调用方根据上下文（AudioContext / OfflineAudioContext）自行连接出口。
 *
 * @param ctx - 任意 BaseAudioContext（实时 AudioContext 或离线 OfflineAudioContext）
 * @param params - 初始处理参数
 * @returns 处理链节点集合
 */
export function buildProcessingChain(
  ctx: BaseAudioContext,
  params: AudioProcessParams = DEFAULT_AUDIO_PROCESS_PARAMS,
): ProcessingChain {
  const lowShelf = ctx.createBiquadFilter()
  lowShelf.type = 'lowshelf'

  const bands: BiquadFilterNode[] = []
  for (let i = 0; i < EQUALIZER_BAND_COUNT; i++) {
    const band = ctx.createBiquadFilter()
    band.type = 'peaking'
    bands.push(band)
  }

  const compressor = ctx.createDynamicsCompressor()
  const makeupGain = ctx.createGain()

  // 连接：LowShelf → EQ[0] → EQ[1] → ... → EQ[4] → Compressor → MakeUp
  lowShelf.connect(bands[0])
  for (let i = 0; i < bands.length - 1; i++) {
    bands[i].connect(bands[i + 1])
  }
  bands[bands.length - 1].connect(compressor)
  compressor.connect(makeupGain)

  const chain: ProcessingChain = {
    input: lowShelf,
    output: makeupGain,
    lowShelf,
    bands,
    compressor,
    makeupGain,
  }
  applyAllParams(chain, params)

  return chain
}

let sharedAudioContext: AudioContext | null = null

/**
 * 获取（必要时创建）全局共享的 AudioContext 单例。
 *
 * 浏览器策略要求 AudioContext 在用户交互后才能恢复播放，
 * 此工厂仅负责懒创建实例，resume 时机由调用方决定。
 * 与 decoder.ts 中的工厂相互独立，避免循环依赖。
 */
export function getAudioContext(): AudioContext {
  if (!sharedAudioContext) {
    const w = window as unknown as {
      AudioContext?: typeof AudioContext
      webkitAudioContext?: typeof AudioContext
    }
    const Ctor = w.AudioContext ?? w.webkitAudioContext ?? AudioContext
    sharedAudioContext = new Ctor()
  }
  return sharedAudioContext
}

/**
 * 实时音频处理器。
 *
 * 封装 Web Audio 处理链与播放控制。参数更新通过 AudioParam.value
 * 直接赋值实现实时无爆音调整；播放基于 AudioBufferSourceNode，
 * 每次 play 重建 source 节点。
 */
export class AudioProcessor {
  private context: AudioContext
  private lowShelfFilter: BiquadFilterNode
  private equalizerBands: BiquadFilterNode[]
  private compressor: DynamicsCompressorNode
  private makeupGain: GainNode
  private currentSource: AudioBufferSourceNode | null
  private currentBuffer: AudioBuffer | null
  /** 当前播放起始对应的 context.currentTime 基准。 */
  private startTime = 0
  /** 是否正在播放。 */
  private playing = false
  /** 主动停止标志，用于区分自然结束与主动停止。 */
  private stopRequested = false
  /** 停止 / 暂停后记录的最后播放位置（秒）。 */
  private lastTime = 0

  /** 播放自然结束时触发的回调（主动停止不触发）。 */
  onEnded?: () => void

  /**
   * @param context - 已创建的 AudioContext，由调用方注入（便于测试与单例管理）
   */
  constructor(context: AudioContext) {
    this.context = context
    const chain = buildProcessingChain(context, DEFAULT_AUDIO_PROCESS_PARAMS)
    this.lowShelfFilter = chain.lowShelf
    this.equalizerBands = chain.bands
    this.compressor = chain.compressor
    this.makeupGain = chain.output
    this.makeupGain.connect(context.destination)
    this.currentSource = null
    this.currentBuffer = null
  }

  /**
   * 设置待播放的音频缓冲。
   * 若当前正在播放会先停止。
   */
  setBuffer(buffer: AudioBuffer): void {
    if (this.playing) {
      this.stop()
    }
    this.currentBuffer = buffer
    this.lastTime = 0
  }

  /**
   * 更新全部处理参数（实时，无爆音）。
   */
  updateParams(params: AudioProcessParams): void {
    this.updateLowShelf(params.lowShelf)
    params.equalizer.forEach((band, index) => {
      if (index < this.equalizerBands.length) {
        this.updateEqualizerBand(index, band)
      }
    })
    this.updateCompressor(params.compressor)
  }

  /**
   * 单独更新低频（LowShelf）参数。
   */
  updateLowShelf(params: LowShelfParams): void {
    applyLowShelfParams(this.lowShelfFilter, params)
  }

  /**
   * 单独更新指定索引的均衡器频段。
   * @param index - 频段索引（0-4），越界将被忽略
   * @param band - 频段参数
   */
  updateEqualizerBand(index: number, band: EqualizerBand): void {
    if (index < 0 || index >= this.equalizerBands.length) {
      return
    }
    applyEqualizerBandParams(this.equalizerBands[index], band)
  }

  /**
   * 单独更新压缩器（含 MakeUp 增益）参数。
   */
  updateCompressor(params: CompressorParams): void {
    applyCompressorParams(this.compressor, this.makeupGain, params)
  }

  /**
   * 从指定位置开始播放。
   * 若当前正在播放，会先停止旧 source 再创建新的。
   * @param offsetSeconds - 起始偏移（秒），默认 0
   */
  play(offsetSeconds = 0): void {
    if (this.playing) {
      this.stop()
    }
    if (!this.currentBuffer) {
      return
    }
    const duration = this.currentBuffer.duration
    const startOffset = Math.max(0, Math.min(offsetSeconds, duration))
    const source = this.context.createBufferSource()
    source.buffer = this.currentBuffer
    source.connect(this.lowShelfFilter)
    this.currentSource = source
    this.stopRequested = false
    this.startTime = this.context.currentTime - startOffset

    source.onended = () => {
      // 主动停止：不触发对外回调，状态已在 stop() 中更新
      if (this.stopRequested) {
        return
      }
      this.playing = false
      this.currentSource = null
      this.lastTime = this.getDuration()
      this.onEnded?.()
    }

    source.start(0, startOffset)
    this.playing = true
  }

  /**
   * 暂停播放。
   * Web Audio 的 AudioBufferSourceNode 不支持真正暂停，
   * 此处记录当前位置后停止，可通过 `getCurrentTime` 获取暂停点。
   */
  pause(): void {
    if (!this.playing) {
      return
    }
    this.lastTime = this.getCurrentTime()
    this.stop()
  }

  /**
   * 停止播放并释放当前 source。
   */
  stop(): void {
    if (!this.currentSource) {
      this.playing = false
      return
    }
    this.stopRequested = true
    if (this.playing) {
      this.lastTime = this.getCurrentTime()
    }
    try {
      this.currentSource.stop()
    } catch {
      // source 可能已停止，忽略异常
    }
    this.currentSource.onended = null
    this.currentSource = null
    this.playing = false
  }

  /**
   * 跳转到指定位置。
   * 若跳转前正在播放，则跳转后继续播放；否则仅更新位置。
   * @param offsetSeconds - 目标位置（秒）
   */
  seek(offsetSeconds: number): void {
    const duration = this.getDuration()
    const target = Math.max(0, Math.min(offsetSeconds, duration))
    const wasPlaying = this.playing
    this.stop()
    this.lastTime = target
    if (wasPlaying) {
      this.play(target)
    }
  }

  /**
   * 获取当前播放位置（秒）。
   * 播放中按 context.currentTime 实时计算；停止后返回最后记录的位置。
   */
  getCurrentTime(): number {
    if (this.playing) {
      const elapsed = this.context.currentTime - this.startTime
      const duration = this.getDuration()
      return duration > 0 ? Math.min(elapsed, duration) : elapsed
    }
    return this.lastTime
  }

  /**
   * 获取当前缓冲的总时长（秒）。
   */
  getDuration(): number {
    return this.currentBuffer ? this.currentBuffer.duration : 0
  }

  /**
   * 是否正在播放。
   */
  isPlaying(): boolean {
    return this.playing
  }
}
