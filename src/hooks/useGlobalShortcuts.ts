/**
 * 全局键盘快捷键。
 *
 * 在 window 上注册单个 keydown 监听器，覆盖播放控制、A/B 切换、
 * 高对比度、帮助与导出对话框等高频操作。通过 ref 读取最新状态，
 * 避免每次状态变化重新订阅。
 *
 * 跳过规则：
 * - 焦点在 INPUT / TEXTAREA / SELECT / contenteditable 时不触发（避免影响输入）；
 * - 按下 Ctrl / Meta 时不触发（避免拦截浏览器快捷键）；
 * - Space 在 BUTTON 上不触发（避免与按钮原生激活重复切换）；
 * - 方向键在 CANVAS 上不触发（波形画布自身已处理跳转）；
 * - 任一对话框打开时，除该对话框自身的 Esc 外，其余快捷键均不触发。
 */
import { useEffect, useRef } from 'react'

import { getAudioContext } from '@/lib/audio/context'
import { getAudioProcessor } from '@/lib/audio/processor'
import type { PlayState } from '@/lib/types'
import { useAudioStore } from '@/store/useAudioStore'

/** 焦点在这些标签上时，所有快捷键均不触发（避免干扰输入）。 */
const ALWAYS_SKIP_TAGS = new Set(['INPUT', 'TEXTAREA', 'SELECT'])

/** 闭包内始终持有的最新状态与 actions，供稳定的事件监听器读取。 */
interface ShortcutContext {
  audioBuffer: AudioBuffer | null
  playState: PlayState
  currentTime: number
  isExportDialogOpen: boolean
  isHelpDialogOpen: boolean
  setPlayState: (s: PlayState) => void
  setCurrentTime: (t: number) => void
  togglePreviewMode: () => void
  toggleHighContrast: () => void
  setHelpDialogOpen: (open: boolean) => void
  setExportDialogOpen: (open: boolean) => void
}

/**
 * 注册全局键盘快捷键。在主页面（Studio）挂载一次即可。
 *
 * 快捷键列表：
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
  // 订阅所需状态与 actions
  const audioBuffer = useAudioStore((s) => s.audioBuffer)
  const playState = useAudioStore((s) => s.playState)
  const currentTime = useAudioStore((s) => s.currentTime)
  const isExportDialogOpen = useAudioStore((s) => s.isExportDialogOpen)
  const isHelpDialogOpen = useAudioStore((s) => s.isHelpDialogOpen)
  const setPlayState = useAudioStore((s) => s.setPlayState)
  const setCurrentTime = useAudioStore((s) => s.setCurrentTime)
  const togglePreviewMode = useAudioStore((s) => s.togglePreviewMode)
  const toggleHighContrast = useAudioStore((s) => s.toggleHighContrast)
  const setHelpDialogOpen = useAudioStore((s) => s.setHelpDialogOpen)
  const setExportDialogOpen = useAudioStore((s) => s.setExportDialogOpen)

  // ref 始终持有最新值，监听器只订阅一次
  const ctxRef = useRef<ShortcutContext>({
    audioBuffer,
    playState,
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
    playState,
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
      // Ctrl / Meta 组合不拦截，留给浏览器快捷键
      if (e.ctrlKey || e.metaKey) return

      const target = e.target as HTMLElement | null
      const tag = target?.tagName ?? ''
      if (ALWAYS_SKIP_TAGS.has(tag) || target?.isContentEditable) return

      const {
        audioBuffer,
        playState,
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

      // 任一对话框打开时，快捷键交由对话框自身处理（Esc 关闭）
      const dialogOpen = isExportDialogOpen || isHelpDialogOpen
      const hasBuffer = Boolean(audioBuffer)
      const duration = audioBuffer?.duration ?? 0

      switch (e.key) {
        case ' ':
        case 'Spacebar': {
          if (!hasBuffer || dialogOpen) return
          // 焦点在按钮上时让原生激活处理，避免重复切换
          if (tag === 'BUTTON') return
          e.preventDefault()
          const processor = getAudioProcessor()
          if (playState === 'playing') {
            processor.pause()
            setPlayState('paused')
            setCurrentTime(processor.getCurrentTime())
          } else {
            const ctx = getAudioContext()
            if (ctx.state === 'suspended') void ctx.resume()
            processor.play(currentTime)
            setPlayState('playing')
          }
          break
        }
        case 's':
        case 'S': {
          if (!hasBuffer || dialogOpen) return
          if (tag === 'BUTTON') return
          e.preventDefault()
          const processor = getAudioProcessor()
          processor.stop()
          setPlayState('stopped')
          setCurrentTime(0)
          break
        }
        case 'ArrowLeft': {
          if (!hasBuffer || dialogOpen) return
          // 波形画布自身已处理方向键跳转
          if (tag === 'CANVAS') return
          e.preventDefault()
          const step = e.shiftKey ? 5 : 1
          const processor = getAudioProcessor()
          processor.seek(Math.max(0, currentTime - step))
          setCurrentTime(processor.getCurrentTime())
          break
        }
        case 'ArrowRight': {
          if (!hasBuffer || dialogOpen) return
          if (tag === 'CANVAS') return
          e.preventDefault()
          const step = e.shiftKey ? 5 : 1
          const processor = getAudioProcessor()
          processor.seek(Math.min(duration, currentTime + step))
          setCurrentTime(processor.getCurrentTime())
          break
        }
        case 'b':
        case 'B': {
          if (!hasBuffer || dialogOpen) return
          if (tag === 'BUTTON') return
          e.preventDefault()
          // 仅切换 store 状态；PreviewPlayer 的 effect 会实时更新处理链参数，
          // 播放中的音频会即时应用新参数，无需停止/重建 source。
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
