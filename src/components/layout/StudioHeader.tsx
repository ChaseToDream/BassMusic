/**
 * Studio 顶部导航栏。
 *
 * 包含品牌标识、高对比度切换、帮助按钮与导出按钮。
 */
import { AudioWaveform, CircleHelp, Contrast, Download } from 'lucide-react'

import { FOCUS_RING } from '@/lib/styles'
import { cn } from '@/lib/utils'
import { useAudioStore } from '@/store/useAudioStore'

/** 顶部导航图标按钮基础样式。 */
const NAV_BTN =
  'inline-flex h-9 w-9 items-center justify-center rounded-md border border-bass-border text-bass-muted transition-colors hover:text-bass-text'

export default function StudioHeader() {
  const audioBuffer = useAudioStore((s) => s.audioBuffer)
  const isHighContrast = useAudioStore((s) => s.isHighContrast)
  const toggleHighContrast = useAudioStore((s) => s.toggleHighContrast)
  const setHelpDialogOpen = useAudioStore((s) => s.setHelpDialogOpen)
  const setExportDialogOpen = useAudioStore((s) => s.setExportDialogOpen)

  const hasBuffer = Boolean(audioBuffer)

  return (
    <header className="sticky top-0 z-40 border-b border-bass-border bg-bass-surface/95 backdrop-blur">
      <div className="mx-auto flex max-w-[1600px] items-center justify-between gap-4 px-4 py-3">
        <div className="flex items-center gap-3">
          <span
            className="flex h-9 w-9 items-center justify-center rounded-md bg-accent/15 text-accent"
            aria-hidden="true"
          >
            <AudioWaveform className="h-5 w-5" />
          </span>
          <div className="leading-tight">
            <h1 className="text-lg font-bold text-bass-text">BassMusic</h1>
            <p className="text-xs text-bass-muted">低频音乐增强转换工具</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* 高对比度切换 */}
          <button
            type="button"
            onClick={toggleHighContrast}
            aria-pressed={isHighContrast}
            aria-label="切换高对比度模式"
            title="高对比度模式"
            className={cn(
              NAV_BTN,
              FOCUS_RING,
              isHighContrast && 'border-accent bg-accent/10 text-accent',
            )}
          >
            <Contrast className="h-4 w-4" aria-hidden="true" />
          </button>

          {/* 帮助 */}
          <button
            type="button"
            onClick={() => setHelpDialogOpen(true)}
            aria-label="打开使用帮助"
            title="帮助"
            className={cn(NAV_BTN, FOCUS_RING)}
          >
            <CircleHelp className="h-4 w-4" aria-hidden="true" />
          </button>

          {/* 导出 */}
          <button
            type="button"
            onClick={() => setExportDialogOpen(true)}
            disabled={!hasBuffer}
            aria-label="导出音频"
            title="导出"
            className={cn(
              'inline-flex items-center gap-1.5 rounded-md bg-accent px-3 py-2 text-sm font-medium text-bass-bg hover:bg-accent-hover',
              FOCUS_RING,
              'disabled:cursor-not-allowed disabled:opacity-50',
            )}
          >
            <Download className="h-4 w-4" aria-hidden="true" />
            <span className="hidden sm:inline">导出</span>
          </button>
        </div>
      </div>
    </header>
  )
}
