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
 * - Space 与 S 在 BUTTON 上不触发（避免与按钮原生激活冲突）；
 * - 方向键在 CANVAS 上不触发；
 * - 任一对话框打开时，除该对话框自身的 Esc 外，其余快捷键均不触发。
 *
 * 播放相关操作统一通过 audioService 完成，并在调用后同步 store 状态
 * （audioService 自身不再直接写 store）。
 */
import { useEffect, useRef } from 'react'

import { audioService } from '@/lib/audio/audioService'
import type { PlayState } from '@/lib/types'
import { useAudioStore } from '@/store/useAudioStore'

/** 焦点在这些标签上时，所有快捷键均不触发。 */
const ALWAYS_SKIP_TAGS = new Set(['INPUT', 'TEXTAREA', 'SELECT'])

/** 闭包内始终持有的最新状态与 actions。 */
interface ShortcutContext {
  audioBuffer: AudioBuffer | null
  currentTime: number
  isExportDialogOpen: boolean
  isHelpDialogOpen: boolean
  setPlayState: (state: PlayState) => void
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
  const setPlayState = useAudioStore((s) => s.setPlayState)
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
    setPlayState,
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
    setPlayState,
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
        setPlayState,
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
            const pos = audioService.pause()
            setPlayState('paused')
            setCurrentTime(pos)
          } else {
            audioService.play(currentTime)
            setPlayState('playing')
          }
          break
        }
        case 's':
        case 'S': {
          if (!hasBuffer || dialogOpen) return
          if (tag === 'BUTTON') return
          e.preventDefault()
          audioService.stop()
          setPlayState('stopped')
          setCurrentTime(0)
          break
        }
        case 'ArrowLeft': {
          if (!hasBuffer || dialogOpen) return
          if (tag === 'CANVAS') return
          e.preventDefault()
          const step = e.shiftKey ? 5 : 1
          const pos = audioService.seek(Math.max(0, currentTime - step))
          setCurrentTime(pos)
          break
        }
        case 'ArrowRight': {
          if (!hasBuffer || dialogOpen) return
          if (tag === 'CANVAS') return
          e.preventDefault()
          const step = e.shiftKey ? 5 : 1
          const pos = audioService.seek(Math.min(duration, currentTime + step))
          setCurrentTime(pos)
          break
        }
        case 'b':
        case 'B': {
          if (!hasBuffer || dialogOpen) return
          e.preventDefault()
          togglePreviewMode()
          break
        }
        case 'c':
        case 'C': {
          if (dialogOpen) return
          e.preventDefault()
          toggleHighContrast()
          break
        }
        case 'h':
        case 'H': {
          if (dialogOpen) return
          e.preventDefault()
          setHelpDialogOpen(true)
          break
        }
        case 'e':
        case 'E': {
          if (!hasBuffer || dialogOpen) return
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
