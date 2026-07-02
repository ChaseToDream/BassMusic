/**
 * 全局键盘快捷键。
 *
 * 在 window 上注册单个 keydown 监听器，覆盖播放控制、A/B 切换、
 * 高对比度、帮助与导出对话框等高频操作。通过 ref 读取最新状态，
 * 避免每次状态变化重新订阅。
 *
 * 跳过规则：
 * - 焦点在 INPUT / TEXTAREA / SELECT / contenteditable 时不触发；
 * - 按下 Ctrl / Meta 时不触发；
 * - Space 在 BUTTON 上不触发；
 * - 方向键在 CANVAS 上不触发；
 * - 任一对话框打开时，除该对话框自身的 Esc 外，其余快捷键均不触发。
 *
 * 播放相关操作统一通过 audioService 完成，避免直接操作 AudioProcessor。
 */
import { useEffect, useRef } from 'react'

import { audioService } from '@/lib/audio/audioService'
import { useAudioStore } from '@/store/useAudioStore'

/** 焦点在这些标签上时，所有快捷键均不触发。 */
const ALWAYS_SKIP_TAGS = new Set(['INPUT', 'TEXTAREA', 'SELECT'])

/** 闭包内始终持有的最新状态与 actions。 */
interface ShortcutContext {
  audioBuffer: AudioBuffer | null
  currentTime: number
  isExportDialogOpen: boolean
  isHelpDialogOpen: boolean
  setCurrentTime: (t: number) => void
  togglePreviewMode: () => void
  toggleHighContrast: () => void
  setHelpDialogOpen: (open: boolean) => void
  setExportDialogOpen: (open: boolean) => void
}

/**
 * 注册全局键盘快捷键。
 *
 * - Space：播放 / 暂停
 * - S：停止
 * - ←：后退 1 秒（Shift 后退 5 秒）
 * - →：前进 1 秒（Shift 前进 5 秒）
 * - B：切换原始 / 处理后预览
 * - C：切换高对比度模式
 * - H：打开帮助
 * - E：打开导出对话框
 */
export function useGlobalShortcuts(): void {
  const audioBuffer = useAudioStore((s) => s.audioBuffer)
  const currentTime = useAudioStore((s) => s.currentTime)
  const isExportDialogOpen = useAudioStore((s) => s.isExportDialogOpen)
  const isHelpDialogOpen = useAudioStore((s) => s.isHelpDialogOpen)
  const setCurrentTime = useAudioStore((s) => s.setCurrentTime)
  const togglePreviewMode = useAudioStore((s) => s.togglePreviewMode)
  const toggleHighContrast = useAudioStore((s) => s.toggleHighContrast)
  const setHelpDialogOpen = useAudioStore((s) => s.setHelpDialogOpen)
  const setExportDialogOpen = useAudioStore((s) => s.setExportDialogOpen)

  const ctxRef = useRef<ShortcutContext>({
    audioBuffer,
    currentTime,
    isExportDialogOpen,
    isHelpDialogOpen,
    setCurrentTime,
    togglePreviewMode,
    toggleHighContrast,
    setHelpDialogOpen,
    setExportDialogOpen,
  })
  ctxRef.current = {
    audioBuffer,
    currentTime,
    isExportDialogOpen,
    isHelpDialogOpen,
    setCurrentTime,
    togglePreviewMode,
    toggleHighContrast,
    setHelpDialogOpen,
    setExportDialogOpen,
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey) return

      const target = e.target as HTMLElement | null
      const tag = target?.tagName ?? ''
      if (ALWAYS_SKIP_TAGS.has(tag) || target?.isContentEditable) return

      const {
        audioBuffer,
        currentTime,
        isExportDialogOpen,
        isHelpDialogOpen,
        setCurrentTime,
        togglePreviewMode,
        toggleHighContrast,
        setHelpDialogOpen,
        setExportDialogOpen,
      } = ctxRef.current

      const dialogOpen = isExportDialogOpen || isHelpDialogOpen
      const hasBuffer = Boolean(audioBuffer)
      const duration = audioBuffer?.duration ?? 0

      switch (e.key) {
        case ' ':
        case 'Spacebar': {
          if (!hasBuffer || dialogOpen) return
          if (tag === 'BUTTON') return
          e.preventDefault()
          if (audioService.isPlaying()) {
            audioService.pause()
          } else {
            audioService.play(currentTime)
          }
          break
        }
        case 's':
        case 'S': {
          if (!hasBuffer || dialogOpen) return
          if (tag === 'BUTTON') return
          e.preventDefault()
          audioService.stop()
          break
        }
        case 'ArrowLeft': {
          if (!hasBuffer || dialogOpen) return
          if (tag === 'CANVAS') return
          e.preventDefault()
          const step = e.shiftKey ? 5 : 1
          audioService.seek(Math.max(0, currentTime - step))
          setCurrentTime(audioService.getCurrentTime())
          break
        }
        case 'ArrowRight': {
          if (!hasBuffer || dialogOpen) return
          if (tag === 'CANVAS') return
          e.preventDefault()
          const step = e.shiftKey ? 5 : 1
          audioService.seek(Math.min(duration, currentTime + step))
          setCurrentTime(audioService.getCurrentTime())
          break
        }
        case 'b':
        case 'B': {
          if (!hasBuffer || dialogOpen) return
          if (tag === 'BUTTON') return
          e.preventDefault()
          togglePreviewMode()
          break
        }
        case 'c':
        case 'C': {
          if (dialogOpen) return
          if (tag === 'BUTTON') return
          e.preventDefault()
          toggleHighContrast()
          break
        }
        case 'h':
        case 'H': {
          if (dialogOpen) return
          if (tag === 'BUTTON') return
          e.preventDefault()
          setHelpDialogOpen(true)
          break
        }
        case 'e':
        case 'E': {
          if (!hasBuffer || dialogOpen) return
          if (tag === 'BUTTON') return
          e.preventDefault()
          setExportDialogOpen(true)
          break
        }
        default:
          break
      }
    }

    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])
}
