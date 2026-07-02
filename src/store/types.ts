/**
 * 全局 Store 类型定义。
 *
 * 将各领域 slice 组合为完整的 AudioStore 类型，供 slices 与组件使用。
 */
import type { AudioSlice } from './slices/audioSlice'
import type { ExportSlice } from './slices/exportSlice'
import type { ParamSlice } from './slices/paramSlice'
import type { PlaybackSlice } from './slices/playbackSlice'
import type { UISlice } from './slices/uiSlice'

/** 完整的音频 store 类型（所有 slice 的组合）。 */
export type AudioStore = AudioSlice & ParamSlice & PlaybackSlice & ExportSlice & UISlice
