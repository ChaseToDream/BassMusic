/**
 * HelpDialog 帮助对话框。
 *
 * 从 store 读取 isHelpDialogOpen 控制显隐，提供 BassMusic 使用帮助：
 * 简介、操作步骤、无障碍特性说明。支持 Esc 关闭、遮罩点击关闭，
 * 打开时自动聚焦关闭按钮，便于键盘用户操作。
 */
import { X } from 'lucide-react'
import { useEffect, useRef } from 'react'

import { useAudioStore } from '@/store/useAudioStore'

/** 统一焦点样式。 */
const FOCUS_RING =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bass-bg'

/** 使用步骤条目：标题与说明。 */
const STEPS: Array<{ title: string; desc: string }> = [
  {
    title: '上传音频文件',
    desc: '支持 MP3 / WAV / FLAC / OGG / M4A，单个文件最大 50 MB',
  },
  {
    title: '选择预设',
    desc: '提供轻度 / 中度 / 重度听障、音乐欣赏、语音清晰等场景预设',
  },
  {
    title: '自定义参数',
    desc: '按需调节低频增强、多频段均衡器与动态范围压缩',
  },
  {
    title: 'A/B 预览对比',
    desc: '在原始与处理后音频之间切换，直观感受增强效果',
  },
  {
    title: '导出音频',
    desc: '将处理后的音频导出为 WAV（无损）或 MP3（压缩）',
  },
]

/** 无障碍特性条目。 */
const A11Y_FEATURES: string[] = [
  '支持完整的键盘导航与快捷操作',
  '兼容屏幕阅读器，关键控件均有语义标签',
  '提供高对比度模式，提升弱视用户可读性',
  '波形与进度支持键盘跳转与方向键调节',
]

/** 键盘快捷键条目：按键与说明。 */
const SHORTCUTS: Array<{ keys: string; desc: string }> = [
  { keys: 'Space', desc: '播放 / 暂停' },
  { keys: 'S', desc: '停止' },
  { keys: '← / →', desc: '后退 / 前进 1 秒（按住 Shift 为 5 秒）' },
  { keys: 'B', desc: '切换原始 / 处理后预览' },
  { keys: 'C', desc: '切换高对比度模式' },
  { keys: 'H', desc: '打开帮助' },
  { keys: 'E', desc: '打开导出对话框' },
  { keys: 'Esc', desc: '关闭对话框' },
]

/**
 * 帮助对话框。
 * 仅当 store 中 isHelpDialogOpen 为 true 时渲染。
 */
export default function HelpDialog() {
  const isOpen = useAudioStore((s) => s.isHelpDialogOpen)
  const setOpen = useAudioStore((s) => s.setHelpDialogOpen)

  const closeBtnRef = useRef<HTMLButtonElement>(null)

  // 打开时注册 Esc 关闭并聚焦关闭按钮
  useEffect(() => {
    if (!isOpen) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false)
      }
    }
    window.addEventListener('keydown', onKey)
    const timer = window.setTimeout(() => {
      closeBtnRef.current?.focus()
    }, 0)
    return () => {
      window.removeEventListener('keydown', onKey)
      window.clearTimeout(timer)
    }
  }, [isOpen, setOpen])

  if (!isOpen) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      onClick={() => setOpen(false)}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="help-dialog-title"
        className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-lg border border-bass-border bg-bass-surface p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-4">
          <h2
            id="help-dialog-title"
            className="text-lg font-semibold text-bass-text"
          >
            BassMusic 使用帮助
          </h2>
          <button
            ref={closeBtnRef}
            type="button"
            aria-label="关闭帮助"
            onClick={() => setOpen(false)}
            className={`inline-flex h-8 w-8 items-center justify-center rounded-md text-bass-muted hover:text-bass-text ${FOCUS_RING}`}
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>

        <div className="mt-4 space-y-5 text-sm">
          {/* 简介 */}
          <p className="text-bass-muted">
            BassMusic 是一款面向听障用户的纯浏览器端音频增强工具，
            通过低频增强、均衡器与动态范围压缩，提升音乐与语音的低频感知与整体可听性。
          </p>

          {/* 操作步骤 */}
          <section>
            <h3 className="font-medium text-bass-text">操作步骤</h3>
            <ol className="mt-2 space-y-2">
              {STEPS.map((step, index) => (
                <li key={step.title} className="flex gap-3">
                  <span
                    aria-hidden="true"
                    className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-accent/15 text-xs font-semibold text-accent"
                  >
                    {index + 1}
                  </span>
                  <div>
                    <p className="font-medium text-bass-text">{step.title}</p>
                    <p className="text-xs text-bass-muted">{step.desc}</p>
                  </div>
                </li>
              ))}
            </ol>
          </section>

          {/* 无障碍特性 */}
          <section>
            <h3 className="font-medium text-bass-text">无障碍特性</h3>
            <ul className="mt-2 space-y-1.5">
              {A11Y_FEATURES.map((feature) => (
                <li
                  key={feature}
                  className="flex items-start gap-2 text-xs text-bass-muted"
                >
                  <span aria-hidden="true" className="mt-1 text-accent">
                    •
                  </span>
                  <span>{feature}</span>
                </li>
              ))}
            </ul>
          </section>

          {/* 键盘快捷键 */}
          <section>
            <h3 className="font-medium text-bass-text">键盘快捷键</h3>
            <dl className="mt-2 space-y-1.5">
              {SHORTCUTS.map((item) => (
                <div
                  key={item.keys}
                  className="flex items-center justify-between gap-3 text-xs"
                >
                  <dt className="text-bass-muted">{item.desc}</dt>
                  <dd>
                    <kbd className="rounded border border-bass-border bg-bass-bg px-1.5 py-0.5 font-mono text-[10px] text-bass-text">
                      {item.keys}
                    </kbd>
                  </dd>
                </div>
              ))}
            </dl>
          </section>
        </div>

        <div className="mt-6 flex justify-end">
          <button
            type="button"
            onClick={() => setOpen(false)}
            className={`rounded-md bg-accent px-4 py-2 text-sm font-medium text-bass-bg hover:bg-accent-hover ${FOCUS_RING}`}
          >
            知道了
          </button>
        </div>
      </div>
    </div>
  )
}
