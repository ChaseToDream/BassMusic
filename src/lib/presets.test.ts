import { describe, it, expect } from 'vitest'

import {
  PRESET_DEFINITIONS,
  PRESET_METADATA,
  applyPreset,
  detectPresetFromParams,
} from './presets'
import {
  DEFAULT_AUDIO_PROCESS_PARAMS,
  type AudioProcessParams,
  type PresetType,
} from './types'

/** 5 个具体预设（不含 custom）。 */
const CONCRETE_PRESETS: PresetType[] = ['mild', 'moderate', 'severe', 'music', 'speech']

/** 预期各预设 EQ 增益（顺序对应 100Hz / 300Hz / 1kHz / 3kHz / 8kHz）。 */
const EXPECTED_EQ_GAINS: Record<Exclude<PresetType, 'custom'>, number[]> = {
  mild: [2, 3, 3, 2, 1],
  moderate: [4, 5, 6, 4, 3],
  severe: [6, 6, 6, 6, 6],
  music: [2, 1, 0, 1, 2],
  speech: [-2, 2, 6, 6, 2],
}

describe('PRESET_DEFINITIONS', () => {
  it('包含 5 个具体预设', () => {
    expect(Object.keys(PRESET_DEFINITIONS).sort()).toEqual([
      'mild',
      'moderate',
      'music',
      'severe',
      'speech',
    ])
  })

  it('每个预设 EQ 为 5 段且增益符合预期', () => {
    for (const preset of CONCRETE_PRESETS) {
      const params = PRESET_DEFINITIONS[preset as Exclude<PresetType, 'custom'>]
      expect(params.equalizer).toHaveLength(5)
      expect(params.equalizer.map((b) => b.gain)).toEqual(
        EXPECTED_EQ_GAINS[preset as Exclude<PresetType, 'custom'>],
      )
    }
  })
})

describe('applyPreset', () => {
  it('5 个具体预设均返回结构正确的参数（EQ 长度为 5）', () => {
    for (const preset of CONCRETE_PRESETS) {
      const params = applyPreset(preset)
      expect(params.lowShelf).toHaveProperty('enabled')
      expect(params.lowShelf).toHaveProperty('frequency')
      expect(params.lowShelf).toHaveProperty('gain')
      expect(params.equalizer).toHaveLength(5)
      params.equalizer.forEach((band, index) => {
        expect(band.id).toBe(index)
        expect(band).toHaveProperty('frequency')
        expect(band).toHaveProperty('q')
      })
      expect(params.compressor).toHaveProperty('enabled')
      expect(params.compressor).toHaveProperty('threshold')
      expect(params.compressor).toHaveProperty('ratio')
      expect(params.compressor).toHaveProperty('attack')
      expect(params.compressor).toHaveProperty('release')
      expect(params.compressor).toHaveProperty('makeupGain')
    }
  })

  it("applyPreset('custom') 返回默认参数", () => {
    const params = applyPreset('custom')
    expect(JSON.stringify(params)).toEqual(JSON.stringify(DEFAULT_AUDIO_PROCESS_PARAMS))
  })

  it('返回值与预设常量值相等但为独立引用（深拷贝）', () => {
    const params = applyPreset('mild')
    expect(JSON.stringify(params)).toEqual(JSON.stringify(PRESET_DEFINITIONS.mild))
    expect(params).not.toBe(PRESET_DEFINITIONS.mild)
    expect(params.lowShelf).not.toBe(PRESET_DEFINITIONS.mild.lowShelf)
    expect(params.compressor).not.toBe(PRESET_DEFINITIONS.mild.compressor)
    expect(params.equalizer).not.toBe(PRESET_DEFINITIONS.mild.equalizer)
    params.equalizer.forEach((band, index) => {
      expect(band).not.toBe(PRESET_DEFINITIONS.mild.equalizer[index])
    })
  })

  it('返回的是深拷贝，修改返回值不影响下次调用与常量', () => {
    const first = applyPreset('moderate')
    first.lowShelf.gain = 999
    first.equalizer[0].gain = 999
    first.compressor.threshold = 999

    const second = applyPreset('moderate')
    expect(second.lowShelf.gain).toBe(PRESET_DEFINITIONS.moderate.lowShelf.gain)
    expect(second.equalizer[0].gain).toBe(PRESET_DEFINITIONS.moderate.equalizer[0].gain)
    expect(second.compressor.threshold).toBe(
      PRESET_DEFINITIONS.moderate.compressor.threshold,
    )

    // 常量未被污染
    expect(PRESET_DEFINITIONS.moderate.lowShelf.gain).not.toBe(999)
    expect(PRESET_DEFINITIONS.moderate.equalizer[0].gain).not.toBe(999)
    expect(PRESET_DEFINITIONS.moderate.compressor.threshold).not.toBe(999)
  })

  it('custom 返回值同样为深拷贝，修改不影响默认常量', () => {
    const first = applyPreset('custom')
    first.lowShelf.gain = 999
    first.equalizer[0].gain = 999
    const second = applyPreset('custom')
    expect(second.lowShelf.gain).toBe(DEFAULT_AUDIO_PROCESS_PARAMS.lowShelf.gain)
    expect(second.equalizer[0].gain).toBe(DEFAULT_AUDIO_PROCESS_PARAMS.equalizer[0].gain)
  })
})

describe('detectPresetFromParams', () => {
  it('传入某预设的参数应返回对应预设名', () => {
    for (const preset of CONCRETE_PRESETS) {
      const params = applyPreset(preset)
      expect(detectPresetFromParams(params)).toBe(preset)
    }
  })

  it('直接传入预设常量也能识别', () => {
    for (const preset of CONCRETE_PRESETS) {
      const params = PRESET_DEFINITIONS[preset as Exclude<PresetType, 'custom'>]
      expect(detectPresetFromParams(params)).toBe(preset)
    }
  })

  it('传入修改后的参数应返回 custom', () => {
    const params: AudioProcessParams = applyPreset('mild')
    params.lowShelf.gain = 0
    expect(detectPresetFromParams(params)).toBe('custom')
  })

  it('默认参数应返回 custom', () => {
    expect(detectPresetFromParams(DEFAULT_AUDIO_PROCESS_PARAMS)).toBe('custom')
  })
})

describe('PRESET_METADATA', () => {
  it('包含全部 6 个预设的元信息', () => {
    expect(PRESET_METADATA).toHaveLength(6)
    const types = PRESET_METADATA.map((m) => m.type)
    expect(types).toEqual(['mild', 'moderate', 'severe', 'music', 'speech', 'custom'])
  })

  it('每项均含 label / description / icon 非空字符串', () => {
    for (const meta of PRESET_METADATA) {
      expect(typeof meta.label).toBe('string')
      expect(meta.label.length).toBeGreaterThan(0)
      expect(typeof meta.description).toBe('string')
      expect(meta.description.length).toBeGreaterThan(0)
      expect(typeof meta.icon).toBe('string')
      expect(meta.icon.length).toBeGreaterThan(0)
    }
  })
})
