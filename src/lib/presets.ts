/**
 * 预设定义模块。
 *
 * 为各具体预设（mild / moderate / severe / music / speech）提供对应的
 * AudioProcessParams，并提供预设应用、预设反查与元信息。
 */
import { cloneParams } from './audio/params'
import {
  DEFAULT_AUDIO_PROCESS_PARAMS,
  type AudioProcessParams,
  type CompressorParams,
  type EqualizerBand,
  type LowShelfParams,
  type PresetType,
} from './types'

/** 具体预设类型（排除 'custom'）。 */
type ConcretePreset = Exclude<PresetType, 'custom'>

/** 均衡器 5 个频段的中心频率（与 DEFAULT_EQUALIZER_BANDS 保持一致）。 */
const EQ_FREQUENCIES = [100, 300, 1000, 3000, 8000] as const

/** 均衡器各频段默认 Q 值。 */
const DEFAULT_Q = 1.0

/**
 * 根据增益数组构建 5 段均衡器频段。
 * @param gains - 依次对应 100Hz / 300Hz / 1kHz / 3kHz / 8kHz 的增益（dB）
 */
function buildEqualizer(
  gains: readonly [number, number, number, number, number],
): EqualizerBand[] {
  return gains.map((gain, index) => ({
    id: index,
    frequency: EQ_FREQUENCIES[index],
    gain,
    q: DEFAULT_Q,
  }))
}

/**
 * 预设参数定义表。
 *
 * 每个预设为独立的对象字面量，互不共享引用；外部使用时应通过 applyPreset
 * 获取深拷贝，避免直接修改此常量。
 */
export const PRESET_DEFINITIONS: Record<ConcretePreset, AudioProcessParams> = {
  /** 轻度听障：低频轻度增强，整体温和放大。 */
  mild: {
    lowShelf: { enabled: true, frequency: 80, gain: 6 },
    equalizer: buildEqualizer([2, 3, 3, 2, 1]),
    compressor: {
      enabled: true,
      threshold: -30,
      ratio: 2,
      attack: 0.005,
      release: 0.25,
      makeupGain: 2,
    },
  },

  /** 中度听障：低频中度增强，提升整体可听性。 */
  moderate: {
    lowShelf: { enabled: true, frequency: 80, gain: 9 },
    equalizer: buildEqualizer([4, 5, 6, 4, 3]),
    compressor: {
      enabled: true,
      threshold: -24,
      ratio: 4,
      attack: 0.003,
      release: 0.25,
      makeupGain: 4,
    },
  },

  /** 重度听障：低频重度增强，全频段补偿。 */
  severe: {
    lowShelf: { enabled: true, frequency: 80, gain: 12 },
    equalizer: buildEqualizer([6, 6, 6, 6, 6]),
    compressor: {
      enabled: true,
      threshold: -18,
      ratio: 8,
      attack: 0.002,
      release: 0.2,
      makeupGain: 6,
    },
  },

  /** 音乐欣赏：平衡增强，弱压缩以保持动态范围。 */
  music: {
    lowShelf: { enabled: true, frequency: 80, gain: 4 },
    equalizer: buildEqualizer([2, 1, 0, 1, 2]),
    compressor: {
      enabled: true,
      threshold: -32,
      ratio: 2,
      attack: 0.01,
      release: 0.4,
      makeupGain: 1,
    },
  },

  /** 语音清晰：突出中频段，强压缩提升语音可懂度。 */
  speech: {
    lowShelf: { enabled: true, frequency: 80, gain: 2 },
    equalizer: buildEqualizer([-2, 2, 6, 6, 2]),
    compressor: {
      enabled: true,
      threshold: -20,
      ratio: 6,
      attack: 0.002,
      release: 0.15,
      makeupGain: 5,
    },
  },
}

/**
 * 应用预设，返回对应的音频处理参数。
 *
 * - 当 preset 为 'custom' 时返回默认参数的深拷贝；
 * - 否则返回 PRESET_DEFINITIONS[preset] 的深拷贝。
 *
 * 返回值可被调用方自由修改，不会影响内部预设常量与后续调用。
 * @param preset - 预设类型
 * @returns 该预设对应的完整音频处理参数（深拷贝）
 */
export function applyPreset(preset: PresetType): AudioProcessParams {
  if (preset === 'custom') {
    return cloneParams(DEFAULT_AUDIO_PROCESS_PARAMS)
  }
  return cloneParams(PRESET_DEFINITIONS[preset])
}

/**
 * 根据参数反查所属预设。
 *
 * 遍历 5 个具体预设，使用 JSON.stringify 进行完全匹配比较；
 * 若与某个预设完全一致则返回该预设名，否则返回 'custom'。
 *
 * 注意：JSON.stringify 对属性顺序敏感，因此比较双方需保持相同结构。
 * 配合 applyPreset 使用时二者结构一致，可正常反查。
 * @param params - 待识别的音频处理参数
 * @returns 匹配的预设类型，无匹配时返回 'custom'
 */
export function detectPresetFromParams(params: AudioProcessParams): PresetType {
  const target = JSON.stringify(params)
  for (const key of Object.keys(PRESET_DEFINITIONS) as ConcretePreset[]) {
    if (JSON.stringify(PRESET_DEFINITIONS[key]) === target) {
      return key
    }
  }
  return 'custom'
}

/** 单个预设的展示元信息。 */
export interface PresetMeta {
  /** 预设类型 */
  type: PresetType
  /** 中文标签 */
  label: string
  /** 中文描述 */
  description: string
  /** 图标标识（lucide-react 图标名） */
  icon: string
}

/**
 * 预设元信息列表，供 UI 选择器渲染使用。
 * 顺序：mild → moderate → severe → music → speech → custom。
 */
export const PRESET_METADATA: PresetMeta[] = [
  {
    type: 'mild',
    label: '轻度听障',
    description: '低频轻度增强，适合轻度听力损失用户',
    icon: 'Volume1',
  },
  {
    type: 'moderate',
    label: '中度听障',
    description: '低频中度增强，提升整体可听性',
    icon: 'Volume2',
  },
  {
    type: 'severe',
    label: '重度听障',
    description: '低频重度增强，全频段补偿',
    icon: 'AudioLines',
  },
  {
    type: 'music',
    label: '音乐欣赏',
    description: '平衡增强，保持音乐动态范围',
    icon: 'Music',
  },
  {
    type: 'speech',
    label: '语音清晰',
    description: '突出中频段，提升语音可懂度',
    icon: 'Mic',
  },
  {
    type: 'custom',
    label: '自定义',
    description: '用户自定义参数',
    icon: 'SlidersHorizontal',
  },
]

/** 重新导出类型，便于消费方统一从 presets 模块引入。 */
export type { LowShelfParams, EqualizerBand, CompressorParams }
