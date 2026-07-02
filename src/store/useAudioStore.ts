/**
 * 全局音频状态管理（zustand）。
 *
 * 按领域拆分为 audio / param / playback / export / ui 五个 slice，
 * 每个 slice 独立维护相关状态与 actions，最后在此组合为单一 store。
 * 外部调用方式保持不变：useAudioStore(selector)。
 */
import { create } from 'zustand'

import { createAudioSlice } from './slices/audioSlice'
import { createExportSlice } from './slices/exportSlice'
import { createParamSlice } from './slices/paramSlice'
import { createPlaybackSlice } from './slices/playbackSlice'
import { createUISlice } from './slices/uiSlice'
import type { AudioStore } from './types'

export const useAudioStore = create<AudioStore>()((...args) => ({
  ...createAudioSlice(...args),
  ...createParamSlice(...args),
  ...createPlaybackSlice(...args),
  ...createExportSlice(...args),
  ...createUISlice(...args),
}))

export type { AudioStore } from './types'
