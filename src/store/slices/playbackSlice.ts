/**
 * 播放控制与预览模式 slice。
 */
import type { StateCreator } from 'zustand'

import type { PlayState, PreviewMode } from '@/lib/types'
import type { AudioStore } from '../types'

export interface PlaybackSlice {
  /** 播放状态。 */
  playState: PlayState
  /** 当前播放时间（秒）。 */
  currentTime: number
  /** A/B 预览模式：原始 / 处理后。 */
  previewMode: PreviewMode

  /** 设置播放状态。 */
  setPlayState: (state: PlayState) => void
  /** 设置当前播放时间。 */
  setCurrentTime: (time: number) => void
  /** 设置预览模式。 */
  setPreviewMode: (mode: PreviewMode) => void
  /** 在原始 / 处理后预览模式间切换。 */
  togglePreviewMode: () => void
}

export const createPlaybackSlice: StateCreator<AudioStore, [], [], PlaybackSlice> = (set) => ({
  playState: 'stopped',
  currentTime: 0,
  previewMode: 'processed',

  setPlayState: (playState) => set({ playState }),
  setCurrentTime: (currentTime) => set({ currentTime }),
  setPreviewMode: (previewMode) => set({ previewMode }),
  togglePreviewMode: () =>
    set((state) => ({
      previewMode: state.previewMode === 'original' ? 'processed' : 'original',
    })),
})
