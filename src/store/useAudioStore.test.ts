/**
 * useAudioStore 单元测试
 *
 * 覆盖：
 * - 初始状态正确
 * - 所有 setter actions（setAudioFile, setLoadingFile, setLoadError, clearAudioFile, etc.）
 * - 所有 参数更新 actions（updateLowShelf, updateEqualizerBand, updateEqualizerBands,
 *   updateCompressor, updateParams, resetParams, applyPreset）
 * - 预设防抖反查（schedulePresetDetect / cancelPresetDetect）
 * - 播放与 UI 状态切换（setPlayState, setCurrentTime, setPreviewMode, togglePreviewMode）
 * - 导出与 UI 控制（setExportProgress, setExportDialogOpen, setHelpDialogOpen, toggleHighContrast）
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

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
    vi.useFakeTimers()
    useAudioStore.setState(getInitialState())
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  // ---- 文件相关 ----

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

  it('setLoadingFile 切换加载状态', () => {
    useAudioStore.getState().setLoadingFile(true)
    expect(useAudioStore.getState().isLoadingFile).toBe(true)
    useAudioStore.getState().setLoadingFile(false)
    expect(useAudioStore.getState().isLoadingFile).toBe(false)
  })

  it('setLoadError 设置和清除错误', () => {
    useAudioStore.getState().setLoadError('文件损坏')
    expect(useAudioStore.getState().loadError).toBe('文件损坏')
    useAudioStore.getState().setLoadError(null)
    expect(useAudioStore.getState().loadError).toBeNull()
  })

  it('clearAudioFile 清除音频数据与元信息', () => {
    const buffer = makeBufferStub()
    const meta: AudioFileMeta = {
      fileName: 'test.wav',
      fileSize: 2048,
      duration: 5,
      sampleRate: 48000,
      numberOfChannels: 1,
    }
    useAudioStore.getState().setAudioFile(buffer, meta)
    useAudioStore.getState().clearAudioFile()
    expect(useAudioStore.getState().audioBuffer).toBeNull()
    expect(useAudioStore.getState().audioMeta).toBeNull()
  })

  // ---- 参数更新（防抖反查预设） ----

  it('updateLowShelf 后 presetType 防抖后切换为 custom', () => {
    useAudioStore.getState().applyPreset('moderate')
    expect(useAudioStore.getState().presetType).toBe('moderate')

    useAudioStore.getState().updateLowShelf({ gain: 7 })
    expect(useAudioStore.getState().params.lowShelf.gain).toBe(7)
    expect(useAudioStore.getState().presetType).toBe('moderate')
    vi.advanceTimersByTime(100)
    expect(useAudioStore.getState().presetType).toBe('custom')
  })

  it('updateEqualizerBand 更新指定频段，其他频段不变', () => {
    const originalGains = useAudioStore
      .getState()
      .params.equalizer.map((band) => band.gain)
    useAudioStore.getState().updateEqualizerBand(0, { gain: 5 })
    const eq = useAudioStore.getState().params.equalizer
    expect(eq[0].gain).toBe(5)
    for (let i = 1; i < eq.length; i++) {
      expect(eq[i].gain).toBe(originalGains[i])
    }
    vi.advanceTimersByTime(100)
    expect(useAudioStore.getState().presetType).toBe('custom')
  })

  it('updateEqualizerBands 整体替换频段数组', () => {
    const newBands = DEFAULT_AUDIO_PROCESS_PARAMS.equalizer.map((b) => ({
      ...b,
      gain: b.gain + 1,
    }))
    useAudioStore.getState().updateEqualizerBands(newBands)
    const eq = useAudioStore.getState().params.equalizer
    for (let i = 0; i < eq.length; i++) {
      expect(eq[i].gain).toBe(newBands[i].gain)
    }
    vi.advanceTimersByTime(100)
    expect(useAudioStore.getState().presetType).toBe('custom')
  })

  it('updateCompressor 更新压缩器参数', () => {
    useAudioStore.getState().updateCompressor({ threshold: -30 })
    expect(useAudioStore.getState().params.compressor.threshold).toBe(-30)
    expect(useAudioStore.getState().params.compressor.ratio).toBe(
      DEFAULT_AUDIO_PROCESS_PARAMS.compressor.ratio,
    )
    vi.advanceTimersByTime(100)
    expect(useAudioStore.getState().presetType).toBe('custom')
  })

  it('updateParams 整体替换参数并防抖反查', () => {
    const newParams = cloneParams(DEFAULT_AUDIO_PROCESS_PARAMS)
    newParams.lowShelf.gain = 20
    useAudioStore.getState().updateParams(newParams)
    expect(useAudioStore.getState().params.lowShelf.gain).toBe(20)
    vi.advanceTimersByTime(100)
    expect(useAudioStore.getState().presetType).toBe('custom')
  })

  it('resetParams 恢复默认参数并立即设 presetType 为 custom（取消防抖）', () => {
    useAudioStore.getState().updateLowShelf({ gain: 99 })
    vi.advanceTimersByTime(100)
    expect(useAudioStore.getState().presetType).toBe('custom')

    useAudioStore.getState().resetParams()
    expect(useAudioStore.getState().params).toEqual(DEFAULT_AUDIO_PROCESS_PARAMS)
    expect(useAudioStore.getState().presetType).toBe('custom')
  })

  it('applyPreset 直接指定 presetType，取消待触发的防抖反查', () => {
    useAudioStore.getState().applyPreset('moderate')
    expect(useAudioStore.getState().presetType).toBe('moderate')
    expect(useAudioStore.getState().params).toEqual(applyPresetParams('moderate'))

    // 防抖反查不会覆盖显式设置的 presetType
    vi.advanceTimersByTime(200)
    expect(useAudioStore.getState().presetType).toBe('moderate')
  })

  // ---- 播放状态 ----

  it('setPlayState 更新播放状态', () => {
    useAudioStore.getState().setPlayState('playing')
    expect(useAudioStore.getState().playState).toBe('playing')
    useAudioStore.getState().setPlayState('paused')
    expect(useAudioStore.getState().playState).toBe('paused')
  })

  it('setCurrentTime 更新播放时间', () => {
    useAudioStore.getState().setCurrentTime(5.5)
    expect(useAudioStore.getState().currentTime).toBe(5.5)
  })

  it('setPreviewMode 直接设置预览模式', () => {
    useAudioStore.getState().setPreviewMode('original')
    expect(useAudioStore.getState().previewMode).toBe('original')
    useAudioStore.getState().setPreviewMode('processed')
    expect(useAudioStore.getState().previewMode).toBe('processed')
  })

  it("togglePreviewMode 在 'original' 与 'processed' 之间切换", () => {
    expect(useAudioStore.getState().previewMode).toBe('processed')
    useAudioStore.getState().togglePreviewMode()
    expect(useAudioStore.getState().previewMode).toBe('original')
    useAudioStore.getState().togglePreviewMode()
    expect(useAudioStore.getState().previewMode).toBe('processed')
  })

  // ---- 导出与 UI 控制 ----

  it('setExportProgress 部分更新导出进度', () => {
    useAudioStore.getState().setExportProgress({ isExporting: true, progress: 0.5 })
    expect(useAudioStore.getState().exportProgress).toEqual({
      isExporting: true,
      progress: 0.5,
    })
    useAudioStore.getState().setExportProgress({ progress: 1.0 })
    expect(useAudioStore.getState().exportProgress).toEqual({
      isExporting: true,
      progress: 1.0,
    })
    useAudioStore.getState().setExportProgress({ isExporting: false, error: '导出失败' })
    expect(useAudioStore.getState().exportProgress.isExporting).toBe(false)
  })

  it('setExportDialogOpen 切换导出对话框', () => {
    useAudioStore.getState().setExportDialogOpen(true)
    expect(useAudioStore.getState().isExportDialogOpen).toBe(true)
    useAudioStore.getState().setExportDialogOpen(false)
    expect(useAudioStore.getState().isExportDialogOpen).toBe(false)
  })

  it('setHelpDialogOpen 切换帮助对话框', () => {
    useAudioStore.getState().setHelpDialogOpen(true)
    expect(useAudioStore.getState().isHelpDialogOpen).toBe(true)
    useAudioStore.getState().setHelpDialogOpen(false)
    expect(useAudioStore.getState().isHelpDialogOpen).toBe(false)
  })

  it('toggleHighContrast 在 true/false 间切换', () => {
    expect(useAudioStore.getState().isHighContrast).toBe(false)
    useAudioStore.getState().toggleHighContrast()
    expect(useAudioStore.getState().isHighContrast).toBe(true)
    useAudioStore.getState().toggleHighContrast()
    expect(useAudioStore.getState().isHighContrast).toBe(false)
  })

  // ---- 防抖反查边界 ----

  it('连续 updateLowShelf 防抖合并，只在停顿后反查一次', () => {
    useAudioStore.getState().applyPreset('moderate')
    useAudioStore.getState().updateLowShelf({ gain: 1 })
    vi.advanceTimersByTime(50) // 还不到 100ms
    useAudioStore.getState().updateLowShelf({ gain: 2 })
    vi.advanceTimersByTime(50) // 还不到 100ms（从第二次调用重新计时）
    expect(useAudioStore.getState().presetType).toBe('moderate') // 仍未触发
    vi.advanceTimersByTime(100) // 第二次调用后 100ms
    expect(useAudioStore.getState().presetType).toBe('custom') // 终于触发
  })

  it('applyPreset 取消未触发的防抖反查', () => {
    useAudioStore.getState().updateLowShelf({ gain: 99 })
    // 此时有一个待触发的防抖反查
    useAudioStore.getState().applyPreset('mild')
    // 推进定时器——防抖反查已被取消，不会覆盖 presetType
    vi.advanceTimersByTime(200)
    expect(useAudioStore.getState().presetType).toBe('mild')
  })
})
