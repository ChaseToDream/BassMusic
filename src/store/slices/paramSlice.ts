/**
 * 音频处理参数与预设 slice。
 *
 * 持有低频增强 / 均衡器 / 压缩器参数与当前预设类型，
 * 每次参数更新后通过防抖调度 detectPresetFromParams 反查当前所属预设。
 */
import type { StateCreator } from 'zustand'

import { cloneParams } from '@/lib/audio/params'
import { applyPreset as applyPresetParams, detectPresetFromParams } from '@/lib/presets'
import {
  DEFAULT_AUDIO_PROCESS_PARAMS,
  type AudioProcessParams,
  type CompressorParams,
  type EqualizerBand,
  type LowShelfParams,
  type PresetType,
} from '@/lib/types'
import type { AudioStore } from '../types'

/** 预设反查防抖延迟（毫秒）。 */
const PRESET_DETECT_DELAY = 100

export interface ParamSlice {
  /** 当前音频处理参数。 */
  params: AudioProcessParams
  /** 当前所属预设类型。 */
  presetType: PresetType

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
}

export const createParamSlice: StateCreator<AudioStore, [], [], ParamSlice> = (set, get) => {
  let presetDetectTimer: ReturnType<typeof setTimeout> | null = null

  function schedulePresetDetect(): void {
    if (presetDetectTimer !== null) {
      clearTimeout(presetDetectTimer)
    }
    presetDetectTimer = setTimeout(() => {
      presetDetectTimer = null
      const params = get().params
      set({ presetType: detectPresetFromParams(params) })
    }, PRESET_DETECT_DELAY)
  }

  function cancelPresetDetect(): void {
    if (presetDetectTimer !== null) {
      clearTimeout(presetDetectTimer)
      presetDetectTimer = null
    }
  }

  return {
    params: cloneParams(DEFAULT_AUDIO_PROCESS_PARAMS),
    presetType: 'custom',

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
          i === index ? { ...current, ...band } : current,
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
        cancelPresetDetect()
        return { params: cloneParams(DEFAULT_AUDIO_PROCESS_PARAMS), presetType: 'custom' }
      }),

    applyPreset: (preset) => {
      cancelPresetDetect()
      set(() => ({
        params: applyPresetParams(preset),
        presetType: preset,
      }))
    },
  }
}
