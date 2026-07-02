/**
 * 音频数据与文件加载状态 slice。
 */
import type { StateCreator } from 'zustand'

import type { AudioFileMeta } from '@/lib/types'
import type { AudioStore } from '../types'

export interface AudioSlice {
  /** 解码后的音频缓冲，未加载时为 null。 */
  audioBuffer: AudioBuffer | null
  /** 音频文件元信息，未加载时为 null。 */
  audioMeta: AudioFileMeta | null
  /** 是否正在加载（解码）文件。 */
  isLoadingFile: boolean
  /** 加载错误信息，无错误时为 null。 */
  loadError: string | null

  /** 设置已解码的音频文件及其元信息。 */
  setAudioFile: (buffer: AudioBuffer, meta: AudioFileMeta) => void
  /** 设置文件加载中状态。 */
  setLoadingFile: (loading: boolean) => void
  /** 设置文件加载错误信息。 */
  setLoadError: (error: string | null) => void
  /** 清除当前音频文件数据。 */
  clearAudioFile: () => void
}

export const createAudioSlice: StateCreator<AudioStore, [], [], AudioSlice> = (set) => ({
  audioBuffer: null,
  audioMeta: null,
  isLoadingFile: false,
  loadError: null,

  /**
   * 设置音频文件时一并重置播放状态与错误，保证 store 在单次 set 内一致：
   * 新文件加载后 playState 必为 stopped、currentTime 必为 0、loadError 必清空。
   * 这样 audioService 不再需要在 setBuffer 时回写 store，消除回环。
   */
  setAudioFile: (audioBuffer, audioMeta) =>
    set({
      audioBuffer,
      audioMeta,
      playState: 'stopped',
      currentTime: 0,
      loadError: null,
    }),
  setLoadingFile: (isLoadingFile) => set({ isLoadingFile }),
  setLoadError: (loadError) => set({ loadError }),
  clearAudioFile: () =>
    set({
      audioBuffer: null,
      audioMeta: null,
      loadError: null,
      isLoadingFile: false,
      playState: 'stopped',
      currentTime: 0,
    }),
})
