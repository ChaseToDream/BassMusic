/**
 * 导出进度与状态 slice。
 */
import type { StateCreator } from 'zustand'

import type { ExportProgress } from '@/lib/types'
import type { AudioStore } from '../types'

export interface ExportSlice {
  /** 导出进度信息。 */
  exportProgress: ExportProgress

  /** 更新导出进度（部分更新）。 */
  setExportProgress: (progress: Partial<ExportProgress>) => void
}

export const createExportSlice: StateCreator<AudioStore, [], [], ExportSlice> = (set) => ({
  exportProgress: { isExporting: false, progress: 0 },

  setExportProgress: (partial) =>
    set((state) => ({
      exportProgress: { ...state.exportProgress, ...partial },
    })),
})
