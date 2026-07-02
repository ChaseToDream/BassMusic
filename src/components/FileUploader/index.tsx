/**
 * FileUploader 文件上传组件。
 *
 * 基于 useAudioFileUpload hook，将不同状态（idle / loading / error / loaded）
 * 拆分为独立子组件，减少单文件复杂度并提升可测试性。
 */
import { useAudioFileUpload } from '@/hooks/useAudioFileUpload'

import { Dropzone } from './Dropzone'
import { FileInput } from './FileInput'
import { UploadError } from './UploadError'
import { UploadLoaded } from './UploadLoaded'
import { UploadLoading } from './UploadLoading'

export default function FileUploader() {
  const {
    inputRef,
    isDragOver,
    state,
    audioMeta,
    loadError,
    openPicker,
    clearAudioFile,
    clearError,
    onInputChange,
    onDrop,
    onDragOver,
    onDragLeave,
    onKeyDown,
  } = useAudioFileUpload()

  return (
    <section className="rounded-lg border border-bass-border bg-bass-surface p-4">
      <h2 className="text-base font-semibold text-bass-text">音频文件</h2>

      {state === 'loaded' && audioMeta && (
        <UploadLoaded meta={audioMeta} onClear={clearAudioFile} />
      )}

      {state === 'error' && loadError && (
        <UploadError error={loadError} onRetry={clearError} />
      )}

      {state === 'loading' && <UploadLoading />}

      {state === 'idle' && (
        <Dropzone
          isDragOver={isDragOver}
          onClick={openPicker}
          onKeyDown={onKeyDown}
          onDrop={onDrop}
          onDragOver={onDragOver}
          onDragLeave={onDragLeave}
        />
      )}

      <FileInput ref={inputRef} onChange={onInputChange} />
    </section>
  )
}
