/**
 * Studio 工作台主页面。
 *
 * 作为应用唯一主页面，仅负责组合布局、功能面板与全局对话框。
 * 具体 UI 片段已拆分到 components/layout 与各个功能组件中。
 */
import BrowserSupportNotice from '@/components/BrowserSupportNotice'
import CompressorPanel from '@/components/CompressorPanel'
import EqualizerPanel from '@/components/EqualizerPanel'
import ExportDialog from '@/components/ExportDialog'
import FileUploader from '@/components/FileUploader'
import HelpDialog from '@/components/HelpDialog'
import LowShelfPanel from '@/components/LowShelfPanel'
import PreviewPlayer from '@/components/PreviewPlayer'
import PresetSelector from '@/components/PresetSelector'
import EmptyState from '@/components/layout/EmptyState'
import StudioHeader from '@/components/layout/StudioHeader'
import StudioLayout from '@/components/layout/StudioLayout'
import { cn } from '@/lib/utils'
import { useGlobalShortcuts } from '@/hooks/useGlobalShortcuts'
import { useAudioStore } from '@/store/useAudioStore'

export function Studio() {
  const audioBuffer = useAudioStore((s) => s.audioBuffer)
  const isHighContrast = useAudioStore((s) => s.isHighContrast)

  useGlobalShortcuts()

  return (
    <div className={cn('min-h-screen bg-bass-bg text-bass-text', isHighContrast && 'high-contrast')}>
      {/* 跳到主内容：仅键盘聚焦时可见 */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:z-50 focus:rounded-md focus:bg-accent focus:px-4 focus:py-2 focus:text-bass-bg"
      >
        跳到主内容
      </a>

      <BrowserSupportNotice />
      <StudioHeader />

      <StudioLayout
        left={
          <>
            <FileUploader />
            <PresetSelector />
          </>
        }
        center={audioBuffer ? <PreviewPlayer /> : <EmptyState />}
        right={
          <>
            <LowShelfPanel />
            <EqualizerPanel />
            <CompressorPanel />
          </>
        }
      />

      {/* 全局对话框 */}
      <ExportDialog />
      <HelpDialog />
    </div>
  )
}

export default Studio
