/**
 * 空闲状态下的拖拽上传区域。
 */
import { Upload } from 'lucide-react'

import { FOCUS_RING } from '@/lib/styles'
import { cn } from '@/lib/utils'

interface DropzoneProps {
  /** 当前是否处于拖拽悬停状态。 */
  isDragOver: boolean
  /** 点击打开文件选择器。 */
  onClick: () => void
  /** 键盘处理器。 */
  onKeyDown: (e: React.KeyboardEvent<HTMLDivElement>) => void
  /** 拖拽释放处理器。 */
  onDrop: (e: React.DragEvent<HTMLDivElement>) => void
  /** 拖拽悬停处理器。 */
  onDragOver: (e: React.DragEvent<HTMLDivElement>) => void
  /** 拖拽离开处理器。 */
  onDragLeave: (e: React.DragEvent<HTMLDivElement>) => void
}

export function Dropzone({
  isDragOver,
  onClick,
  onKeyDown,
  onDrop,
  onDragOver,
  onDragLeave,
}: DropzoneProps) {
  return (
    <div
      role="button"
      tabIndex={0}
      aria-label="上传音频文件"
      onClick={onClick}
      onKeyDown={onKeyDown}
      onDrop={onDrop}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      className={cn(
        'mt-3 flex cursor-pointer flex-col items-center justify-center gap-3 rounded-md border-2 border-dashed p-8 text-center transition-colors',
        isDragOver
          ? 'border-accent bg-accent/10'
          : 'border-bass-border hover:border-bass-muted hover:bg-bass-surface-2',
        FOCUS_RING,
      )}
    >
      <Upload className="h-8 w-8 text-accent" aria-hidden="true" />
      <div>
        <p className="text-sm font-medium text-bass-text">
          拖拽音频文件到这里，或点击选择
        </p>
        <p className="mt-1 text-xs text-bass-muted">
          支持 MP3 / WAV / FLAC / OGG / M4A，最大 50 MB
        </p>
      </div>
    </div>
  )
}
