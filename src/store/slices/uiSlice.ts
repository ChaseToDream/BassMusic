/**
 * UI 状态 slice。
 *
 * 持有对话框开关、高对比度模式等纯界面状态。
 */
import type { StateCreator } from 'zustand'

import type { AudioStore } from '../types'

export interface UISlice {
  /** 导出对话框是否打开。 */
  isExportDialogOpen: boolean
  /** 帮助对话框是否打开。 */
  isHelpDialogOpen: boolean
  /** 是否开启高对比度模式。 */
  isHighContrast: boolean

  /** 设置导出对话框开关。 */
  setExportDialogOpen: (open: boolean) => void
  /** 设置帮助对话框开关。 */
  setHelpDialogOpen: (open: boolean) => void
  /** 切换高对比度模式。 */
  toggleHighContrast: () => void
}

export const createUISlice: StateCreator<AudioStore, [], [], UISlice> = (set) => ({
  isExportDialogOpen: false,
  isHelpDialogOpen: false,
  isHighContrast: false,

  setExportDialogOpen: (isExportDialogOpen) => set({ isExportDialogOpen }),
  setHelpDialogOpen: (isHelpDialogOpen) => set({ isHelpDialogOpen }),
  toggleHighContrast: () => set((state) => ({ isHighContrast: !state.isHighContrast })),
})
