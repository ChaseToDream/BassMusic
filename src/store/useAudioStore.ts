/**
 * 全局音频状态管理（zustand）。
 *
 * 持有音频数据、处理参数、预设、播放、上传、导出与 UI 状态，
 * 并提供不可变更新 actions。每次参数更新后自动调用 detectPresetFromParams
 * 反查当前所属预设；若不匹配任何具体预设，则将 presetType 置为 'custom'。
 */
import { create } from 'zustand'

import { applyPreset as applyPresetParams, detectPresetFromParams } from '@/lib/presets'
import {
  DEFAULT_AUDIO_PROCESS_PARAMS,
  type AudioFileMeta,
  type AudioProcessParams,
  type CompressorParams,
  type EqualizerBand,
  type ExportProgress,
  type LowShelfParams,
  type PlayState,
  type PreviewMode,
  type PresetType,
} from '@/lib/types'

/**
 * 深拷贝音频处理参数，确保 store 内部状态与外部传入对象互不共享引用。
 * 参数仅含普通对象、数组与原始值，逐层展开即可安全克隆。
 */
function cloneParams(params: AudioProcessParams): AudioProcessParams {
  return {
    lowShelf: { ...params.lowShelf },
    equalizer: params.equalizer.map((band) => ({ ...band })),
    compressor: { ...params.compressor },
  }
}

/** 全局音频状态字段。 */
export interface AudioStoreState {
  /** 解码后的音频缓冲，未加载时为 null。 */
  audioBuffer: AudioBuffer | null
  /** 音频文件元信息，未加载时为 null。 */
  audioMeta: AudioFileMeta | null

  /** 当前音频处理参数（低频增强 / 均衡器 / 压缩器）。 */
  params: AudioProcessParams
  /** 当前所属预设类型，参数变化后自动反查。 */
  presetType: PresetType

  /** 播放状态。 */
  playState: PlayState
  /** 当前播放时间（秒）。 */
  currentTime: number
  /** A/B 预览模式：原始 / 处理后。 */
  previewMode: PreviewMode

  /** 是否正在加载（解码）文件。 */
  isLoadingFile: boolean
  /** 加载错误信息，无错误时为 null。 */
  loadError: string | null

  /** 导出进度信息。 */
  exportProgress: ExportProgress

  /** 导出对话框是否打开。 */
  isExportDialogOpen: boolean
  /** 帮助对话框是否打开。 */
  isHelpDialogOpen: boolean
  /** 是否开启高对比度模式。 */
  isHighContrast: boolean
}

/** 全局音频状态 actions。 */
export interface AudioStoreActions {
  /** 设置已解码的音频文件及其元信息。 */
  setAudioFile: (buffer: AudioBuffer, meta: AudioFileMeta) => void
  /** 设置文件加载中状态。 */
  setLoadingFile: (loading: boolean) => void
  /** 设置文件加载错误信息。 */
  setLoadError: (error: string | null) => void
  /** 清除当前音频文件数据。 */
  clearAudioFile: () => void

  /** 更新低频增强参数（部分更新），并自动反查预设。 */
  updateLowShelf: (params: Partial<LowShelfParams>) => void
  /** 更新指定索引的均衡器频段（部分更新），并自动反查预设。 */
  updateEqualizerBand: (index: number, band: Partial<EqualizerBand>) => void
  /** 整体替换均衡器频段数组，并自动反查预设。 */
  updateEqualizerBands: (bands: EqualizerBand[]) => void
  /** 更新压缩器参数（部分更新），并自动反查预设。 */
  updateCompressor: (params: Partial<CompressorParams>) => void
  /** 整体替换音频处理参数，并自动反查预设。 */
  updateParams: (params: AudioProcessParams) => void
  /** 重置为默认参数，并自动反查预设。 */
  resetParams: () => void

  /** 应用指定预设，更新参数与 presetType。 */
  applyPreset: (preset: PresetType) => void

  /** 设置播放状态。 */
  setPlayState: (state: PlayState) => void
  /** 设置当前播放时间。 */
  setCurrentTime: (time: number) => void
  /** 设置预览模式。 */
  setPreviewMode: (mode: PreviewMode) => void
  /** 在原始 / 处理后预览模式间切换。 */
  togglePreviewMode: () => void

  /** 更新导出进度（部分更新）。 */
  setExportProgress: (progress: Partial<ExportProgress>) => void
  /** 设置导出对话框开关。 */
  setExportDialogOpen: (open: boolean) => void

  /** 设置帮助对话框开关。 */
  setHelpDialogOpen: (open: boolean) => void
  /** 切换高对比度模式。 */
  toggleHighContrast: () => void
}

/** 完整的音频 store 类型（状态 + actions）。 */
export type AudioStore = AudioStoreState & AudioStoreActions

/** 初始导出进度。 */
const INITIAL_EXPORT_PROGRESS: ExportProgress = {
  isExporting: false,
  progress: 0,
}

export const useAudioStore = create<AudioStore>((set) => ({
  // ---- 音频数据 ----
  audioBuffer: null,
  audioMeta: null,

  // ---- 处理参数 ----
  params: cloneParams(DEFAULT_AUDIO_PROCESS_PARAMS),
  presetType: 'custom',

  // ---- 播放状态 ----
  playState: 'stopped',
  currentTime: 0,
  previewMode: 'processed',

  // ---- 上传状态 ----
  isLoadingFile: false,
  loadError: null,

  // ---- 导出状态 ----
  exportProgress: { ...INITIAL_EXPORT_PROGRESS },

  // ---- UI 状态 ----
  isExportDialogOpen: false,
  isHelpDialogOpen: false,
  isHighContrast: false,

  // ---- 文件 ----
  setAudioFile: (audioBuffer, audioMeta) => set({ audioBuffer, audioMeta }),
  setLoadingFile: (isLoadingFile) => set({ isLoadingFile }),
  setLoadError: (loadError) => set({ loadError }),
  clearAudioFile: () => set({ audioBuffer: null, audioMeta: null }),

  // ---- 参数更新（每次更新后自动反查预设） ----
  updateLowShelf: (partial) =>
    set((state) => {
      const params: AudioProcessParams = {
        ...state.params,
        lowShelf: { ...state.params.lowShelf, ...partial },
      }
      return { params, presetType: detectPresetFromParams(params) }
    }),

  updateEqualizerBand: (index, band) =>
    set((state) => {
      const equalizer = state.params.equalizer.map((current, i) =>
        i === index ? { ...current, ...band } : { ...current },
      )
      const params: AudioProcessParams = { ...state.params, equalizer }
      return { params, presetType: detectPresetFromParams(params) }
    }),

  updateEqualizerBands: (bands) =>
    set((state) => {
      const params: AudioProcessParams = {
        ...state.params,
        equalizer: bands.map((band) => ({ ...band })),
      }
      return { params, presetType: detectPresetFromParams(params) }
    }),

  updateCompressor: (partial) =>
    set((state) => {
      const params: AudioProcessParams = {
        ...state.params,
        compressor: { ...state.params.compressor, ...partial },
      }
      return { params, presetType: detectPresetFromParams(params) }
    }),

  updateParams: (nextParams) =>
    set(() => {
      const params = cloneParams(nextParams)
      return { params, presetType: detectPresetFromParams(params) }
    }),

  resetParams: () =>
    set(() => {
      const params = cloneParams(DEFAULT_AUDIO_PROCESS_PARAMS)
      return { params, presetType: detectPresetFromParams(params) }
    }),

  // ---- 预设 ----
  applyPreset: (preset) =>
    set(() => ({
      params: applyPresetParams(preset),
      presetType: preset,
    })),

  // ---- 播放 ----
  setPlayState: (playState) => set({ playState }),
  setCurrentTime: (currentTime) => set({ currentTime }),
  setPreviewMode: (previewMode) => set({ previewMode }),
  togglePreviewMode: () =>
    set((state) => ({
      previewMode: state.previewMode === 'original' ? 'processed' : 'original',
    })),

  // ---- 导出 ----
  setExportProgress: (partial) =>
    set((state) => ({
      exportProgress: { ...state.exportProgress, ...partial },
    })),
  setExportDialogOpen: (isExportDialogOpen) => set({ isExportDialogOpen }),

  // ---- UI ----
  setHelpDialogOpen: (isHelpDialogOpen) => set({ isHelpDialogOpen }),
  toggleHighContrast: () =>
    set((state) => ({ isHighContrast: !state.isHighContrast })),
}))
