/**
 * 音频文件上传 hook。
 *
 * 封装拖拽交互、文件校验（扩展名/MIME/魔数）、解码与 store 写入的完整工作流，
 * 返回当前状态与事件处理器，供 FileUploader 组件族消费。
 */
import {
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type DragEvent,
  type KeyboardEvent,
} from 'react'

import {
  decodeAudioFile,
  getAudioMeta,
  validateAudioFile,
  verifyMagicBytes,
} from '@/lib/audio/decoder'
import { logger } from '@/lib/logger'
import { useAudioStore } from '@/store/useAudioStore'
import type { AudioFileMeta } from '@/lib/types'

/** 上传组件状态。 */
export type UploadState = 'idle' | 'loading' | 'error' | 'loaded'

export interface UseAudioFileUploadReturn {
  /** 隐藏文件 input 的 ref。 */
  inputRef: React.RefObject<HTMLInputElement>
  /** 当前是否处于拖拽悬停状态。 */
  isDragOver: boolean
  /** 当前上传状态。 */
  state: UploadState
  /** 已加载的音频元信息（仅在 loaded 状态有效）。 */
  audioMeta: AudioFileMeta | null
  /** 当前加载错误（仅在 error 状态有效）。 */
  loadError: string | null
  /** 处理选中的文件。 */
  handleFile: (file: File) => Promise<void>
  /** 打开文件选择器。 */
  openPicker: () => void
  /** 清除当前文件。 */
  clearAudioFile: () => void
  /** 清除错误信息。 */
  clearError: () => void
  /** 文件 input 的 change 处理器。 */
  onInputChange: (e: ChangeEvent<HTMLInputElement>) => void
  /** 拖拽释放处理器。 */
  onDrop: (e: DragEvent<HTMLDivElement>) => void
  /** 拖拽悬停处理器。 */
  onDragOver: (e: DragEvent<HTMLDivElement>) => void
  /** 拖拽离开处理器。 */
  onDragLeave: (e: DragEvent<HTMLDivElement>) => void
  /** 键盘处理器（用于触发文件选择器）。 */
  onKeyDown: (e: KeyboardEvent<HTMLDivElement>) => void
}

export function useAudioFileUpload(): UseAudioFileUploadReturn {
  const inputRef = useRef<HTMLInputElement>(null)
  const [isDragOver, setIsDragOver] = useState(false)

  const audioMeta = useAudioStore((s) => s.audioMeta)
  const isLoadingFile = useAudioStore((s) => s.isLoadingFile)
  const loadError = useAudioStore((s) => s.loadError)
  const setAudioFile = useAudioStore((s) => s.setAudioFile)
  const setLoadingFile = useAudioStore((s) => s.setLoadingFile)
  const setLoadError = useAudioStore((s) => s.setLoadError)
  const clearAudioFile = useAudioStore((s) => s.clearAudioFile)

  // 并发取消：每次 handleFile 自增 reqId，await 后判断是否为最新请求
  const reqIdRef = useRef(0)
  // unmount 保护：避免卸载后仍写 store
  const mountedRef = useRef(true)
  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
    }
  }, [])

  const state: UploadState = audioMeta
    ? 'loaded'
    : loadError
      ? 'error'
      : isLoadingFile
        ? 'loading'
        : 'idle'

  const openPicker = () => inputRef.current?.click()

  const handleFile = async (file: File) => {
    const currentReqId = ++reqIdRef.current
    const isStale = () => currentReqId !== reqIdRef.current || !mountedRef.current

    setLoadError(null)

    const result = validateAudioFile(file)
    if (!result.valid) {
      if (!isStale()) setLoadError(result.error ?? '文件无效')
      return
    }

    const magicResult = await verifyMagicBytes(file)
    if (isStale()) return
    if (!magicResult.valid) {
      if (!isStale()) setLoadError(magicResult.error ?? '文件无效')
      return
    }

    setLoadingFile(true)
    try {
      const buffer = await decodeAudioFile(file)
      if (isStale()) return
      const meta = getAudioMeta(file, buffer)
      setAudioFile(buffer, meta)
    } catch (err) {
      if (isStale()) return
      logger.error('音频解码失败：', err)
      setLoadError('音频文件解码失败，可能已损坏或编码不支持')
    } finally {
      if (!isStale()) setLoadingFile(false)
    }
  }

  const onInputChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) void handleFile(file)
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

  return {
    inputRef,
    isDragOver,
    state,
    audioMeta,
    loadError,
    handleFile,
    openPicker,
    clearAudioFile,
    clearError: () => setLoadError(null),
    onInputChange,
    onDrop,
    onDragOver,
    onDragLeave,
    onKeyDown,
  }
}
