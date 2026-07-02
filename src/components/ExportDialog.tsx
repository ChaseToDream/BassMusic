import { CheckCircle2, Loader2, X } from 'lucide-react'
import { useEffect, useRef, useState, type FormEvent } from 'react'

import { downloadBlob, exportAudio } from '@/lib/audio/exporter'
import type { ExportFormat } from '@/lib/types'
import { cn } from '@/lib/utils'
import { useAudioStore } from '@/store/useAudioStore'

type Bitrate = 128 | 192 | 320

const BITRATES: Bitrate[] = [128, 192, 320]
const FORMATS: readonly ExportFormat[] = ['wav', 'mp3']

/**
 * 导出对话框。
 *
 * 选择导出格式（WAV / MP3）与 MP3 比特率，调用 exportAudio 离线渲染并下载。
 * 支持 Esc / 遮罩点击关闭、导出进度展示、完成后 2 秒自动关闭。
 */
export default function ExportDialog() {
  const isOpen = useAudioStore((s) => s.isExportDialogOpen)
  const setOpen = useAudioStore((s) => s.setExportDialogOpen)
  const audioBuffer = useAudioStore((s) => s.audioBuffer)
  const audioMeta = useAudioStore((s) => s.audioMeta)
  const params = useAudioStore((s) => s.params)
  const exportProgress = useAudioStore((s) => s.exportProgress)
  const setExportProgress = useAudioStore((s) => s.setExportProgress)

  const [format, setFormat] = useState<ExportFormat>('wav')
  const [bitrate, setBitrate] = useState<Bitrate>(192)

  const closeBtnRef = useRef<HTMLButtonElement>(null)

  // Esc 关闭 + 打开时聚焦首个可聚焦元素
  useEffect(() => {
    if (!isOpen) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false)
      }
    }
    window.addEventListener('keydown', onKey)
    const t = window.setTimeout(() => {
      closeBtnRef.current?.focus()
    }, 0)
    return () => {
      window.removeEventListener('keydown', onKey)
      window.clearTimeout(t)
    }
  }, [isOpen, setOpen])

  // 导出完成 2 秒后自动关闭并重置进度（避免下次打开立即触发关闭）
  useEffect(() => {
    if (!isOpen) return
    const done =
      !exportProgress.isExporting && exportProgress.progress >= 1 && !exportProgress.error
    if (!done) return
    const t = window.setTimeout(() => {
      setOpen(false)
      setExportProgress({ isExporting: false, progress: 0, error: undefined })
    }, 2000)
    return () => window.clearTimeout(t)
  }, [isOpen, exportProgress, setOpen, setExportProgress])

  if (!isOpen) return null

  const baseName = audioMeta?.fileName.replace(/\.[^.]+$/, '') || 'audio'
  const ext = format === 'wav' ? 'wav' : 'mp3'
  const filename = `${baseName}_bassmusic.${ext}`

  const handleExport = async (e: FormEvent) => {
    e.preventDefault()
    if (!audioBuffer) return
    try {
      setExportProgress({
        isExporting: true,
        progress: 0,
        format,
        error: undefined,
      })
      const blob = await exportAudio(
        audioBuffer,
        params,
        { format, mp3Bitrate: format === 'mp3' ? bitrate : undefined },
        (p) => setExportProgress({ progress: p }),
      )
      downloadBlob(blob, filename)
      setExportProgress({ isExporting: false, progress: 1 })
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      setExportProgress({ isExporting: false, error: `导出失败：${message}` })
    }
  }

  const isExporting = exportProgress.isExporting
  const isDone = !isExporting && exportProgress.progress >= 1 && !exportProgress.error
  const percent = Math.round(exportProgress.progress * 100)

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      onClick={() => setOpen(false)}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="export-dialog-title"
        className="w-full max-w-md rounded-lg border border-bass-border bg-bass-surface p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h2 id="export-dialog-title" className="text-lg font-semibold text-bass-text">
            导出音频
          </h2>
          <button
            ref={closeBtnRef}
            type="button"
            aria-label="关闭"
            onClick={() => setOpen(false)}
            className="inline-flex h-8 w-8 items-center justify-center rounded-md text-bass-muted hover:text-bass-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bass-bg"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <form className="mt-4 space-y-4" onSubmit={handleExport}>
          {/* 格式选择 */}
          <fieldset>
            <legend className="text-sm font-medium text-bass-text">导出格式</legend>
            <div className="mt-2 grid grid-cols-2 gap-2">
              {FORMATS.map((f) => (
                <label
                  key={f}
                  className={cn(
                    'flex cursor-pointer items-center justify-center rounded-md border px-3 py-2 text-sm transition-colors',
                    format === f
                      ? 'border-accent bg-accent/10 text-accent'
                      : 'border-bass-border text-bass-muted hover:text-bass-text',
                  )}
                >
                  <input
                    type="radio"
                    name="format"
                    value={f}
                    checked={format === f}
                    onChange={() => setFormat(f)}
                    disabled={isExporting}
                    className="sr-only"
                  />
                  {f === 'wav' ? 'WAV（无损）' : 'MP3（压缩）'}
                </label>
              ))}
            </div>
          </fieldset>

          {/* MP3 比特率 */}
          {format === 'mp3' && (
            <fieldset>
              <legend className="text-sm font-medium text-bass-text">MP3 比特率</legend>
              <div className="mt-2 grid grid-cols-3 gap-2">
                {BITRATES.map((b) => (
                  <label
                    key={b}
                    className={cn(
                      'flex cursor-pointer items-center justify-center rounded-md border px-2 py-2 text-sm transition-colors',
                      bitrate === b
                        ? 'border-accent bg-accent/10 text-accent'
                        : 'border-bass-border text-bass-muted hover:text-bass-text',
                    )}
                  >
                    <input
                      type="radio"
                      name="bitrate"
                      value={b}
                      checked={bitrate === b}
                      onChange={() => setBitrate(b)}
                      disabled={isExporting}
                      className="sr-only"
                    />
                    {b} kbps
                  </label>
                ))}
              </div>
            </fieldset>
          )}

          {/* 文件名预览 */}
          <p className="text-xs text-bass-muted">
            文件名：<span className="text-bass-text">{filename}</span>
          </p>

          {/* 进度 */}
          {(isExporting || exportProgress.progress > 0) && (
            <div className="space-y-1">
              <div className="flex items-center justify-between text-xs text-bass-muted">
                <span className="inline-flex items-center gap-1">
                  {isExporting && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                  {isDone ? '导出完成' : isExporting ? '导出中…' : '已导出'}
                </span>
                <span className="tabular-nums">{percent}%</span>
              </div>
              <div
                className="h-2 w-full overflow-hidden rounded-full bg-bass-bg"
                role="progressbar"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={percent}
              >
                <div
                  className="h-full rounded-full bg-accent transition-[width] duration-200"
                  style={{ width: `${percent}%` }}
                />
              </div>
            </div>
          )}

          {/* 错误提示 */}
          {exportProgress.error && (
            <p
              role="alert"
              className="rounded-md border border-red-500/40 bg-red-500/10 px-3 py-2 text-xs text-red-300"
            >
              {exportProgress.error}
            </p>
          )}

          {/* 成功提示 */}
          {isDone && !exportProgress.error && (
            <p className="inline-flex items-center gap-1 text-xs text-accent">
              <CheckCircle2 className="h-3.5 w-3.5" />
              导出成功，2 秒后自动关闭
            </p>
          )}

          {/* 操作按钮 */}
          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setOpen(false)}
              disabled={isExporting}
              className="rounded-md border border-bass-border px-4 py-2 text-sm text-bass-muted hover:text-bass-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bass-bg disabled:cursor-not-allowed disabled:opacity-50"
            >
              取消
            </button>
            <button
              type="submit"
              disabled={isExporting || !audioBuffer}
              className="inline-flex items-center gap-1.5 rounded-md bg-accent px-4 py-2 text-sm font-medium text-bass-bg hover:bg-accent-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bass-bg disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isExporting && <Loader2 className="h-4 w-4 animate-spin" />}
              {isExporting ? '导出中' : '开始导出'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
