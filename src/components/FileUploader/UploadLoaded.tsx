/**
 * 音频文件加载成功后的元信息展示。
 */
import { FileAudio, X } from 'lucide-react'

import { formatChannels, formatSeconds } from '@/lib/format'
import { FOCUS_RING } from '@/lib/styles'
import { cn } from '@/lib/utils'
import type { AudioFileMeta } from '@/lib/types'

interface UploadLoadedProps {
  /** 音频元信息。 */
  meta: AudioFileMeta
  /** 清除当前文件。 */
  onClear: () => void
}

export function UploadLoaded({ meta, onClear }: UploadLoadedProps) {
  return (
    <div className="mt-3 flex items-start gap-3 rounded-md border border-bass-border bg-bass-surface-2 p-3">
      <FileAudio className="mt-0.5 h-5 w-5 shrink-0 text-accent" aria-hidden="true" />
      <div className="min-w-0 flex-1">
        <p
          className="truncate text-sm font-medium text-bass-text"
          title={meta.fileName}
        >
          {meta.fileName}
        </p>
        <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
          <div>
            <dt className="inline text-bass-muted">时长：</dt>
            <dd className="inline text-bass-text">
              {formatSeconds(meta.duration)}
            </dd>
          </div>
          <div>
            <dt className="inline text-bass-muted">采样率：</dt>
            <dd className="inline text-bass-text">{meta.sampleRate} Hz</dd>
          </div>
          <div>
            <dt className="inline text-bass-muted">声道：</dt>
            <dd className="inline text-bass-text">
              {formatChannels(meta.numberOfChannels)}
            </dd>
          </div>
        </dl>
      </div>
      <button
        type="button"
        onClick={onClear}
        className={cn(
          'mt-3 inline-flex items-center gap-1.5 rounded-md border border-bass-border px-3 py-1.5 text-sm text-bass-text hover:bg-bass-surface-2',
          FOCUS_RING,
        )}
      >
        <X className="h-4 w-4" aria-hidden="true" />
        更换文件
      </button>
    </div>
  )
}
