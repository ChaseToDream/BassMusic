/**
 * FileUploader 文件上传组件。
 *
 * 支持拖拽与点击选择音频文件，校验后解码写入全局 store；
 * 分别展示加载中、错误、成功（音频元信息）三种状态。
 */
import { useRef, useState, type ChangeEvent, type DragEvent, type KeyboardEvent } from 'react'
import { AlertCircle, FileAudio, Loader2, RefreshCw, Upload, X } from 'lucide-react'
import { decodeAudioFile, getAudioMeta, validateAudioFile } from '@/lib/audio/decoder'
import { useAudioStore } from '@/store/useAudioStore'
import { cn } from '@/lib/utils'

/** 将秒数格式化为 mm:ss。 */
function formatDuration(seconds: number): string {
  const total = Math.max(0, Math.round(seconds))
  const m = Math.floor(total / 60)
  const s = total % 60
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

/** 声道数转中文描述。 */
function formatChannels(n: number): string {
  if (n === 1) return '单声道'
  if (n === 2) return '立体声'
  return `${n} 声道`
}

/** 统一焦点样式。 */
const FOCUS_RING =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bass-bg'

export default function FileUploader() {
  const inputRef = useRef<HTMLInputElement>(null)
  const [isDragOver, setIsDragOver] = useState(false)

  const audioMeta = useAudioStore((s) => s.audioMeta)
  const isLoadingFile = useAudioStore((s) => s.isLoadingFile)
  const loadError = useAudioStore((s) => s.loadError)
  const setAudioFile = useAudioStore((s) => s.setAudioFile)
  const setLoadingFile = useAudioStore((s) => s.setLoadingFile)
  const setLoadError = useAudioStore((s) => s.setLoadError)
  const clearAudioFile = useAudioStore((s) => s.clearAudioFile)

  const openPicker = () => inputRef.current?.click()

  /** 处理选中/拖入的文件：校验 → 解码 → 写入 store。 */
  const handleFile = async (file: File) => {
    setLoadError(null)
    const result = validateAudioFile(file)
    if (!result.valid) {
      setLoadError(result.error ?? '文件无效')
      return
    }
    setLoadingFile(true)
    try {
      const buffer = await decodeAudioFile(file)
      const meta = getAudioMeta(file, buffer)
      setAudioFile(buffer, meta)
    } catch {
      setLoadError('音频文件解码失败，可能已损坏或编码不支持')
    } finally {
      setLoadingFile(false)
    }
  }

  const onInputChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) void handleFile(file)
    // 重置 value 以允许重复选择同一文件
    e.target.value = ''
  }

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      openPicker()
    }
  }

  const onDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setIsDragOver(false)
    const file = e.dataTransfer.files?.[0]
    if (file) void handleFile(file)
  }

  const onDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setIsDragOver(true)
  }

  const onDragLeave = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setIsDragOver(false)
  }

  // 隐藏的文件 input（aria-hidden，由拖拽区域代理触发）
  const fileInput = (
    <input
      ref={inputRef}
      type="file"
      accept=".mp3,.wav,.flac,.ogg,.m4a"
      onChange={onInputChange}
      aria-hidden="true"
      tabIndex={-1}
      className="sr-only"
    />
  )

  // 成功状态：展示音频元信息
  if (audioMeta) {
    return (
      <section className="rounded-lg border border-bass-border bg-bass-surface p-4">
        <h2 className="text-base font-semibold text-bass-text">音频文件</h2>
        <div className="mt-3 flex items-start gap-3 rounded-md border border-bass-border bg-bass-surface-2 p-3">
          <FileAudio className="mt-0.5 h-5 w-5 shrink-0 text-accent" aria-hidden="true" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-bass-text" title={audioMeta.fileName}>
              {audioMeta.fileName}
            </p>
            <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
              <div>
                <dt className="inline text-bass-muted">时长：</dt>
                <dd className="inline text-bass-text">{formatDuration(audioMeta.duration)}</dd>
              </div>
              <div>
                <dt className="inline text-bass-muted">采样率：</dt>
                <dd className="inline text-bass-text">{audioMeta.sampleRate} Hz</dd>
              </div>
              <div>
                <dt className="inline text-bass-muted">声道：</dt>
                <dd className="inline text-bass-text">{formatChannels(audioMeta.numberOfChannels)}</dd>
              </div>
            </dl>
          </div>
        </div>
        <button
          type="button"
          onClick={clearAudioFile}
          className={cn(
            'mt-3 inline-flex items-center gap-1.5 rounded-md border border-bass-border px-3 py-1.5 text-sm text-bass-text hover:bg-bass-surface-2',
            FOCUS_RING,
          )}
        >
          <X className="h-4 w-4" aria-hidden="true" />
          更换文件
        </button>
        {fileInput}
      </section>
    )
  }

  // 错误状态
  if (loadError) {
    return (
      <section className="rounded-lg border border-bass-border bg-bass-surface p-4">
        <h2 className="text-base font-semibold text-bass-text">音频文件</h2>
        <div
          role="alert"
          className="mt-3 flex items-start gap-3 rounded-md border border-red-500/40 bg-red-500/10 p-3"
        >
          <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-red-400" aria-hidden="true" />
          <div className="flex-1">
            <p className="text-sm text-red-300">{loadError}</p>
            <button
              type="button"
              onClick={() => setLoadError(null)}
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
        {fileInput}
      </section>
    )
  }

  // 加载中状态
  if (isLoadingFile) {
    return (
      <section className="rounded-lg border border-bass-border bg-bass-surface p-4">
        <div
          className="flex items-center justify-center gap-3 py-10"
          role="status"
          aria-live="polite"
        >
          <Loader2 className="h-5 w-5 animate-spin text-accent" aria-hidden="true" />
          <span className="text-sm text-bass-muted">正在解码音频...</span>
        </div>
      </section>
    )
  }

  // 默认：拖拽上传区域
  return (
    <section className="rounded-lg border border-bass-border bg-bass-surface p-4">
      <h2 className="text-base font-semibold text-bass-text">音频文件</h2>
      <div
        role="button"
        tabIndex={0}
        aria-label="上传音频文件"
        onClick={openPicker}
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
          <p className="text-sm font-medium text-bass-text">拖拽音频文件到这里，或点击选择</p>
          <p className="mt-1 text-xs text-bass-muted">
            支持 MP3 / WAV / FLAC / OGG / M4A，最大 50 MB
          </p>
        </div>
      </div>
      {fileInput}
    </section>
  )
}
