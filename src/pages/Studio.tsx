/**
 * Studio 工作台主页面。
 *
 * 组合文件上传、预设选择、参数面板（低频/均衡/压缩）、波形可视化、
 * 预览播放与导出，采用响应式三栏布局：
 * - 桌面（≥1280px）：左（上传/预设）｜中（波形/播放器）｜右（参数面板）；
 * - 平板（768-1279px）：左右两栏置顶，参数面板移至下方三列；
 * - 手机（<768px）：单列垂直堆叠（导航→上传→预设→波形→播放→低频→均衡→压缩）。
 *
 * 含空状态引导、跳到主内容链接、高对比度模式与帮助/导出对话框。
 */
import { AudioWaveform, CircleHelp, Contrast, Download, Upload } from 'lucide-react'

import BrowserSupportNotice from '@/components/BrowserSupportNotice'
import CompressorPanel from '@/components/CompressorPanel'
import EqualizerPanel from '@/components/EqualizerPanel'
import ExportDialog from '@/components/ExportDialog'
import FileUploader from '@/components/FileUploader'
import HelpDialog from '@/components/HelpDialog'
import LowShelfPanel from '@/components/LowShelfPanel'
import PreviewPlayer from '@/components/PreviewPlayer'
import PresetSelector from '@/components/PresetSelector'
import { useGlobalShortcuts } from '@/hooks/useGlobalShortcuts'
import { useAudioStore } from '@/store/useAudioStore'
import { cn } from '@/lib/utils'

/** 统一焦点样式。 */
const FOCUS_RING =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bass-bg'

/** 顶部导航图标按钮基础样式。 */
const NAV_BTN =
  'inline-flex h-9 w-9 items-center justify-center rounded-md border border-bass-border text-bass-muted transition-colors hover:text-bass-text'

/**
 * Studio 工作台页面组件。
 * 作为应用唯一主页面，挂载全部功能面板与全局对话框。
 */
export function Studio() {
  const audioBuffer = useAudioStore((s) => s.audioBuffer)
  const isHighContrast = useAudioStore((s) => s.isHighContrast)
  const toggleHighContrast = useAudioStore((s) => s.toggleHighContrast)
  const setHelpDialogOpen = useAudioStore((s) => s.setHelpDialogOpen)
  const setExportDialogOpen = useAudioStore((s) => s.setExportDialogOpen)

  // 注册全局键盘快捷键（播放、跳转、A/B、高对比度、帮助、导出）
  useGlobalShortcuts()

  const hasBuffer = Boolean(audioBuffer)

  return (
    <div
      className={cn(
        'min-h-screen bg-bass-bg text-bass-text',
        isHighContrast && 'high-contrast',
      )}
    >
      {/* 跳到主内容：仅键盘聚焦时可见 */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:z-50 focus:rounded-md focus:bg-accent focus:px-4 focus:py-2 focus:text-bass-bg"
      >
        跳到主内容
      </a>

      <BrowserSupportNotice />

      {/* 顶部导航栏 */}
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

      {/* 主内容区 */}
      <main
        id="main-content"
        tabIndex={-1}
        className="mx-auto max-w-[1600px] px-4 py-6 outline-none"
      >
        <div className="grid grid-cols-1 items-start gap-4 md:grid-cols-[320px_1fr] xl:grid-cols-[320px_1fr_360px]">
          {/* 左栏：上传 + 预设 */}
          <div className="flex flex-col gap-4">
            <FileUploader />
            <PresetSelector />
          </div>

          {/* 中栏：波形可视化 + 预览播放器（含 A/B 切换） */}
          <div className="flex flex-col gap-4">
            {hasBuffer ? (
              <PreviewPlayer />
            ) : (
              <EmptyState />
            )}
          </div>

          {/* 右栏：参数面板。无音频时灰显，平板下方三列、桌面单列堆叠 */}
          <div
            className={cn(
              'grid grid-cols-1 gap-4 md:col-span-2 md:grid-cols-3 xl:col-span-1 xl:grid-cols-1',
              !hasBuffer && 'pointer-events-none select-none opacity-40',
            )}
            aria-disabled={!hasBuffer}
          >
            <LowShelfPanel />
            <EqualizerPanel />
            <CompressorPanel />
          </div>
        </div>
      </main>

      {/* 全局对话框 */}
      <ExportDialog />
      <HelpDialog />
    </div>
  )
}

/**
 * 空状态引导卡片。
 * 未加载音频时显示在中栏，引导用户前往左侧上传区域。
 */
function EmptyState() {
  return (
    <section
      className="flex flex-1 flex-col items-center justify-center rounded-lg border-2 border-dashed border-bass-border bg-bass-surface p-10 text-center"
      aria-labelledby="empty-state-title"
    >
      <span
        className="flex h-14 w-14 items-center justify-center rounded-full bg-accent/10 text-accent"
        aria-hidden="true"
      >
        <Upload className="h-7 w-7" />
      </span>
      <h2
        id="empty-state-title"
        className="mt-4 text-lg font-semibold text-bass-text"
      >
        上传音频文件以开始
      </h2>
      <p className="mt-2 max-w-sm text-sm text-bass-muted">
        从左侧上传区域选择或拖入音频文件，即可进行低频增强、均衡与压缩处理，
        并通过 A/B 预览对比效果。
      </p>
      <p className="mt-3 text-xs text-bass-muted">
        支持 MP3 / WAV / FLAC / OGG / M4A，最大 50 MB
      </p>
    </section>
  )
}

export default Studio
