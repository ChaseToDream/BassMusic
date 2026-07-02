/**
 * 文件上传/解码失败时的错误提示。
 */
import { AlertCircle, RefreshCw } from 'lucide-react'

import { FOCUS_RING } from '@/lib/styles'
import { cn } from '@/lib/utils'

interface UploadErrorProps {
  /** 错误信息。 */
  error: string
  /** 点击重试/清除错误。 */
  onRetry: () => void
}

export function UploadError({ error, onRetry }: UploadErrorProps) {
  return (
    <div
      role="alert"
      className="mt-3 flex items-start gap-3 rounded-md border border-red-500/40 bg-red-500/10 p-3"
    >
      <AlertCircle
        className="mt-0.5 h-5 w-5 shrink-0 text-red-400"
        aria-hidden="true"
      />
      <div className="flex-1">
        <p className="text-sm text-red-300">{error}</p>
        <button
          type="button"
          onClick={onRetry}
          className={cn(
            'mt-2 inline-flex items-center gap-1.5 rounded-md border border-bass-border px-2.5 py-1 text-xs text-bass-text hover:bg-bass-surface-2',
            FOCUS_RING,
          )}
        >
          <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
          重试
        </button>
      </div>
    </div>
  )
}
