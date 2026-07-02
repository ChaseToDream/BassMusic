/**
 * 音频处理参数工具函数。
 *
 * 提供参数的深拷贝、旁路构造等通用操作，供 store 与预设模块共享。
 */
import type { AudioProcessParams, EqualizerBand } from '../types'

/**
 * 深拷贝音频处理参数，确保 store 内部状态与外部传入对象互不共享引用。
 * 参数仅含普通对象、数组与原始值，逐层展开即可安全克隆。
 */
export function cloneParams(params: AudioProcessParams): AudioProcessParams {
  return {
    lowShelf: { ...params.lowShelf },
    equalizer: params.equalizer.map((band: EqualizerBand) => ({ ...band })),
    compressor: { ...params.compressor },
  }
}

/**
 * 构造旁路参数集：关闭低频增强与压缩器、清零各频段增益，
 * 用于"原始"预览模式，使处理链等价于直通。
 */
export function buildBypassParams(params: AudioProcessParams): AudioProcessParams {
  return {
    lowShelf: { ...params.lowShelf, enabled: false },
    equalizer: params.equalizer.map((b) => ({ ...b, gain: 0 })),
    compressor: { ...params.compressor, enabled: false },
  }
}
