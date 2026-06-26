/**
 * 全局音频状态管理（zustand）。
 *
 * 持有音频数据、处理参数、预设、播放、上传、导出与 UI 状态，
 * 并提供不可变更新 actions。每次参数更新后通过防抖调度 detectPresetFromParams
 * 反查当前所属预设；若不匹配任何具体预设，则将 presetType 置为 'custom'。
 *
 * 防抖说明：拖动滑块等连续参数更新会高频触发，预设反查本身需对 5 个预设
 * 做全量比较，开销不可忽略。通过 PRESET_DETECT_DELAY 防抖合并连续更新，
 * 仅在交互停顿后反查一次，避免拖动过程中每帧都执行 stringify 比较。
 * applyPreset 为整体替换，presetType 由调用方直接指定，无需防抖。
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

/** 预设反查防抖延迟（毫秒）。拖动滑块等连续更新的停顿后触发一次反查。 */
const PRESET_DETECT_DELAY = 100

/** 待执行的预设反查定时器句柄。 */
let presetDetectTimer: ReturnType<typeof setTimeout> | null = null

/**
 * 调度一次防抖的预设反查。
 *
 * 取消尚未触发的旧定时器，并在 PRESET_DETECT_DELAY 毫秒后读取最新 params
 * 进行反查。连续调用会不断推迟触发，最终只在最后一次更新后执行一次。
 */
function schedulePresetDetect(): void {
  if (presetDetectTimer !== null) {
    clearTimeout(presetDetectTimer)
  }
  presetDetectTimer = setTimeout(() => {
    presetDetectTimer = null
    const params = useAudioStore.getState().params
    useAudioStore.setState({ presetType: detectPresetFromParams(params) })
  }, PRESET_DETECT_DELAY)
}

/**
 * 取消尚未触发的预设反查定时器。
 * 在 applyPreset 等直接指定 presetType 的操作前调用，避免迟到的反查覆盖显式设置的值。
 */
function cancelPresetDetect(): void {
  if (presetDetectTimer !== null) {
    clearTimeout(presetDetectTimer)
    presetDetectTimer = null
  }
}

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

  // ---- 参数更新（每次更新后防抖反查预设） ----
  updateLowShelf: (partial) =>
    set((state) => {
      const params: AudioProcessParams = {
        ...state.params,
        lowShelf: { ...state.params.lowShelf, ...partial },
      }
      schedulePresetDetect()
      return { params }
    }),

  updateEqualizerBand: (index, band) =>
    set((state) => {
      const equalizer = state.params.equalizer.map((current, i) =>
        i === index ? { ...current, ...band } : { ...current },
      )
      const params: AudioProcessParams = { ...state.params, equalizer }
      schedulePresetDetect()
      return { params }
    }),

  updateEqualizerBands: (bands) =>
    set((state) => {
      const params: AudioProcessParams = {
        ...state.params,
        equalizer: bands.map((band) => ({ ...band })),
      }
      schedulePresetDetect()
      return { params }
    }),

  updateCompressor: (partial) =>
    set((state) => {
      const params: AudioProcessParams = {
        ...state.params,
        compressor: { ...state.params.compressor, ...partial },
      }
      schedulePresetDetect()
      return { params }
    }),

  updateParams: (nextParams) =>
    set(() => {
      const params = cloneParams(nextParams)
      schedulePresetDetect()
      return { params }
    }),

  resetParams: () =>
    set(() => {
      const params = cloneParams(DEFAULT_AUDIO_PROCESS_PARAMS)
      // 重置为默认参数，presetType 必然为 'custom'，直接指定并取消待触发的反查。
      cancelPresetDetect()
      return { params, presetType: 'custom' }
    }),

  // ---- 预设 ----
  applyPreset: (preset) => {
    // 整体替换参数并直接指定 presetType，取消待触发的防抖反查避免覆盖。
    cancelPresetDetect()
    set(() => ({
      params: applyPresetParams(preset),
      presetType: preset,
    }))
  },

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
