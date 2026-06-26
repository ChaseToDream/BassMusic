/**
 * useAudioStore 单元测试
 *
 * 覆盖：
 * - 初始状态正确（读取 store 创建时的原始状态）
 * - setAudioFile 后状态更新
 * - updateLowShelf 后 presetType 自动切换为 'custom'
 * - applyPreset('moderate') 后 params 与 presetType 都更新
 * - updateEqualizerBand(0, { gain: 5 }) 后 EQ[0] 的 gain 为 5，其他频段不变
 * - togglePreviewMode 在 'original' 与 'processed' 之间切换
 * - toggleHighContrast 在 true/false 间切换
 */
import { describe, it, expect, beforeEach } from 'vitest'

import { useAudioStore } from './useAudioStore'
import { applyPreset as applyPresetParams } from '@/lib/presets'
import {
  DEFAULT_AUDIO_PROCESS_PARAMS,
  type AudioFileMeta,
  type AudioProcessParams,
  type PlayState,
  type PreviewMode,
  type PresetType,
} from '@/lib/types'

/** 深拷贝音频处理参数，避免测试间共享引用造成污染。 */
function cloneParams(params: AudioProcessParams): AudioProcessParams {
  return {
    lowShelf: { ...params.lowShelf },
    equalizer: params.equalizer.map((band) => ({ ...band })),
    compressor: { ...params.compressor },
  }
}

/** 构造 AudioBuffer 桩（jsdom 不提供真实 Web Audio API）。 */
function makeBufferStub(): AudioBuffer {
  return {
    duration: 10,
    sampleRate: 44100,
    numberOfChannels: 2,
  } as unknown as AudioBuffer
}

/**
 * 返回与 store 创建时一致的初始数据状态（不含 actions），
 * 供 beforeEach 通过 setState 合并重置，确保用例间状态隔离。
 */
function getInitialState() {
  return {
    audioBuffer: null as AudioBuffer | null,
    audioMeta: null as AudioFileMeta | null,
    params: cloneParams(DEFAULT_AUDIO_PROCESS_PARAMS),
    presetType: 'custom' as PresetType,
    playState: 'stopped' as PlayState,
    currentTime: 0,
    previewMode: 'processed' as PreviewMode,
    isLoadingFile: false,
    loadError: null as string | null,
    exportProgress: { isExporting: false, progress: 0 },
    isExportDialogOpen: false,
    isHelpDialogOpen: false,
    isHighContrast: false,
  }
}

// ===================== 初始状态 =====================

describe('useAudioStore 初始状态', () => {
  it('初始状态正确', () => {
    // 直接读取 store 创建时的原始状态（此为该文件首个用例，未被任何操作污染）
    const state = useAudioStore.getState()
    expect(state.audioBuffer).toBeNull()
    expect(state.audioMeta).toBeNull()
    expect(state.params).toEqual(DEFAULT_AUDIO_PROCESS_PARAMS)
    expect(state.presetType).toBe('custom')
    expect(state.playState).toBe('stopped')
    expect(state.currentTime).toBe(0)
    expect(state.previewMode).toBe('processed')
    expect(state.isLoadingFile).toBe(false)
    expect(state.loadError).toBeNull()
    expect(state.exportProgress).toEqual({ isExporting: false, progress: 0 })
    expect(state.isExportDialogOpen).toBe(false)
    expect(state.isHelpDialogOpen).toBe(false)
    expect(state.isHighContrast).toBe(false)
  })
})

// ===================== Actions =====================

describe('useAudioStore actions', () => {
  beforeEach(() => {
    // 每个用例前重置为初始数据状态，避免状态污染
    useAudioStore.setState(getInitialState())
  })

  it('setAudioFile 后状态更新', () => {
    const buffer = makeBufferStub()
    const meta: AudioFileMeta = {
      fileName: 'demo.mp3',
      fileSize: 1024,
      duration: 10,
      sampleRate: 44100,
      numberOfChannels: 2,
    }
    useAudioStore.getState().setAudioFile(buffer, meta)
    const state = useAudioStore.getState()
    expect(state.audioBuffer).toBe(buffer)
    expect(state.audioMeta).toEqual(meta)
  })

  it('updateLowShelf 后 presetType 自动切换为 custom', () => {
    // 先应用 moderate 预设，使 presetType 偏离初始的 custom
    useAudioStore.getState().applyPreset('moderate')
    expect(useAudioStore.getState().presetType).toBe('moderate')

    // 修改 lowShelf.gain 使其不再匹配任何预设（moderate 的 gain 为 9）
    useAudioStore.getState().updateLowShelf({ gain: 7 })
    const state = useAudioStore.getState()
    expect(state.params.lowShelf.gain).toBe(7)
    expect(state.params.lowShelf.frequency).toBe(80)
    expect(state.presetType).toBe('custom')
  })

  it("applyPreset('moderate') 后 params 与 presetType 都更新", () => {
    useAudioStore.getState().applyPreset('moderate')
    const state = useAudioStore.getState()
    expect(state.presetType).toBe('moderate')
    expect(state.params).toEqual(applyPresetParams('moderate'))
    expect(state.params.lowShelf.gain).toBe(9)
    expect(state.params.equalizer.map((band) => band.gain)).toEqual([4, 5, 6, 4, 3])
  })

  it("updateEqualizerBand(0, { gain: 5 }) 后 EQ[0] 的 gain 为 5，其他频段不变", () => {
    const originalGains = useAudioStore
      .getState()
      .params.equalizer.map((band) => band.gain)

    useAudioStore.getState().updateEqualizerBand(0, { gain: 5 })

    const eq = useAudioStore.getState().params.equalizer
    expect(eq[0].gain).toBe(5)
    for (let i = 1; i < eq.length; i++) {
      expect(eq[i].gain).toBe(originalGains[i])
    }
    // 修改后不再匹配默认参数，预设切换为 custom
    expect(useAudioStore.getState().presetType).toBe('custom')
  })

  it("togglePreviewMode 在 'original' 与 'processed' 之间切换", () => {
    expect(useAudioStore.getState().previewMode).toBe('processed')
    useAudioStore.getState().togglePreviewMode()
    expect(useAudioStore.getState().previewMode).toBe('original')
    useAudioStore.getState().togglePreviewMode()
    expect(useAudioStore.getState().previewMode).toBe('processed')
  })

  it('toggleHighContrast 在 true/false 间切换', () => {
    expect(useAudioStore.getState().isHighContrast).toBe(false)
    useAudioStore.getState().toggleHighContrast()
    expect(useAudioStore.getState().isHighContrast).toBe(true)
    useAudioStore.getState().toggleHighContrast()
    expect(useAudioStore.getState().isHighContrast).toBe(false)
  })
})
