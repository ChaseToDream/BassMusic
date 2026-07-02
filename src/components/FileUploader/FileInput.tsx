/**
 * 隐藏的文件选择 input。
 *
 * 视觉与辅助树中均不可见，由拖拽区域代理触发。
 */
import { forwardRef, type ChangeEvent } from 'react'

interface FileInputProps {
  /** 文件选择后的回调。 */
  onChange: (e: ChangeEvent<HTMLInputElement>) => void
}

export const FileInput = forwardRef<HTMLInputElement, FileInputProps>(
  function FileInput({ onChange }, ref) {
    return (
      <input
        ref={ref}
        type="file"
        accept=".mp3,.wav,.flac,.ogg,.m4a"
        onChange={onChange}
        aria-hidden="true"
        tabIndex={-1}
        className="sr-only"
      />
    )
  },
)
