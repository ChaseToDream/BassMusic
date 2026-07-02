/**
 * 音频文件解码中的加载状态。
 */
import { Loader2 } from 'lucide-react'

export function UploadLoading() {
  return (
    <div
      className="flex items-center justify-center gap-3 py-10"
      role="status"
      aria-live="polite"
    >
      <Loader2 className="h-5 w-5 animate-spin text-accent" aria-hidden="true" />
      <span className="text-sm text-bass-muted">正在解码音频...</span>
    </div>
  )
}
