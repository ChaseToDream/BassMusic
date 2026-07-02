/**
 * BassMusic 全局类型定义。
 * 该文件是后续所有音频处理模块、状态管理与组件的基础契约。
 */

/** 音频文件元信息 */
export interface AudioFileMeta {
  fileName: string
  fileSize: number // bytes
  duration: number // seconds
  sampleRate: number // Hz
  numberOfChannels: number // 1 or 2 typically
}

/** 低频增强参数（BiquadFilter LowShelf） */
export interface LowShelfParams {
  enabled: boolean
  frequency: number // 20-250 Hz, default 80
  gain: number // 0 to +15 dB, default 6
}

/** 均衡器单个频段 */
export interface EqualizerBand {
  id: number
  frequency: number // 60 Hz - 16 kHz
  gain: number // -12 to +12 dB
  q: number // 0.5 - 6.0
}

/** 动态范围压缩参数 */
export interface CompressorParams {
  enabled: boolean
  threshold: number // -60 to 0 dB, default -24
  ratio: number // 1 to 20, default 4
  attack: number // 0 to 1 s, default 0.003
  release: number // 0 to 1 s, default 0.25
  makeupGain: number // 0 to +12 dB, default 3
}

/** 预设类型枚举 */
export type PresetType = 'mild' | 'moderate' | 'severe' | 'music' | 'speech' | 'custom'

/** 完整的音频处理参数（一整套） */
export interface AudioProcessParams {
  lowShelf: LowShelfParams
  equalizer: EqualizerBand[] // length 5
  compressor: CompressorParams
}

/** 导出格式 */
export type ExportFormat = 'wav' | 'mp3'

/** 导出选项 */
export interface ExportOptions {
  format: ExportFormat
  mp3Bitrate?: 128 | 192 | 320 // kbps, only for mp3
}

/** A/B 预览模式 */
export type PreviewMode = 'original' | 'processed'

/** 播放状态 */
export type PlayState = 'stopped' | 'playing' | 'paused'

/** 导出进度 */
export interface ExportProgress {
  isExporting: boolean
  progress: number // 0-1
  format?: ExportFormat
  error?: string
}

/* ===== 默认参数常量 ===== */

/** 默认低频增强参数 */
export const DEFAULT_LOW_SHELF_PARAMS: LowShelfParams = {
  enabled: true,
  frequency: 80,
  gain: 6,
}

/** 默认均衡器频段（5 个频段） */
export const DEFAULT_EQUALIZER_BANDS: EqualizerBand[] = [
  { id: 0, frequency: 100, gain: 0, q: 1.0 },
  { id: 1, frequency: 300, gain: 0, q: 1.0 },
  { id: 2, frequency: 1000, gain: 0, q: 1.0 },
  { id: 3, frequency: 3000, gain: 0, q: 1.0 },
  { id: 4, frequency: 8000, gain: 0, q: 1.0 },
]

/** 默认动态范围压缩参数 */
export const DEFAULT_COMPRESSOR_PARAMS: CompressorParams = {
  enabled: true,
  threshold: -24,
  ratio: 4,
  attack: 0.003,
  release: 0.25,
  makeupGain: 3,
}

/** 默认音频处理参数（组合上述默认值） */
export const DEFAULT_AUDIO_PROCESS_PARAMS: AudioProcessParams = {
  lowShelf: { ...DEFAULT_LOW_SHELF_PARAMS },
  equalizer: DEFAULT_EQUALIZER_BANDS.map((b) => ({ ...b })),
  compressor: { ...DEFAULT_COMPRESSOR_PARAMS },
}
