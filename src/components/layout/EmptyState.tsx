/**
 * 空状态引导卡片。
 *
 * 未加载音频时显示，引导用户前往左侧上传区域。
 */
import { Upload } from 'lucide-react'

export default function EmptyState() {
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
      <h2 id="empty-state-title" className="mt-4 text-lg font-semibold text-bass-text">
        上传音频文件以开始
      </h2>
      <p className="mt-2 max-w-sm text-sm text-bass-muted">
        从左侧上传区域选择或拖入音频文件，即可进行低频增强、均衡与压缩处理，并通过 A/B
        预览对比效果。
      </p>
      <p className="mt-3 text-xs text-bass-muted">
        支持 MP3 / WAV / FLAC / OGG / M4A，最大 50 MB
      </p>
    </section>
  )
}
