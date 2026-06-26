/**
 * PresetSelector 预设选择器。
 *
 * 渲染 PRESET_METADATA 中的 6 个预设按钮，点击应用对应预设；
 * 高亮当前激活预设，hover/focus 显示完整描述。
 */
import {
  AudioLines,
  Mic,
  Music,
  SlidersHorizontal,
  Volume1,
  Volume2,
  type LucideIcon,
} from 'lucide-react'
import { PRESET_METADATA } from '@/lib/presets'
import { useAudioStore } from '@/store/useAudioStore'
import { cn } from '@/lib/utils'
import { Tooltip } from '@/components/ui/Tooltip'

/** 预设图标名（PRESET_METADATA.icon）到 lucide 组件的映射。 */
const ICON_MAP: Record<string, LucideIcon> = {
  Volume1,
  Volume2,
  AudioLines,
  Music,
  Mic,
  SlidersHorizontal,
}

/** 统一焦点样式。 */
const FOCUS_RING =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bass-bg'

export default function PresetSelector() {
  const presetType = useAudioStore((s) => s.presetType)
  const applyPreset = useAudioStore((s) => s.applyPreset)

  return (
    <section className="rounded-lg border border-bass-border bg-bass-surface p-4">
      <h2 className="text-base font-semibold text-bass-text">预设</h2>
      <p className="mt-1 text-sm text-bass-muted">选择适合场景的预设方案</p>
      <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2">
        {PRESET_METADATA.map((meta) => {
          const Icon = ICON_MAP[meta.icon] ?? SlidersHorizontal
          const isActive = presetType === meta.type
          return (
            <Tooltip key={meta.type} content={meta.description}>
              <button
                type="button"
                onClick={() => applyPreset(meta.type)}
                aria-label={`${meta.label} 预设`}
                aria-pressed={isActive}
                className={cn(
                  'flex w-full flex-col items-start gap-1 rounded-md border p-3 text-left transition-colors',
                  FOCUS_RING,
                  isActive
                    ? 'border-accent bg-accent/10'
                    : 'border-bass-border bg-bass-surface-2 hover:border-bass-muted',
                )}
              >
                <Icon className="h-5 w-5 text-accent" aria-hidden="true" />
                <span className="text-sm font-medium text-bass-text">{meta.label}</span>
                <span className="text-xs text-bass-muted">{meta.description}</span>
              </button>
            </Tooltip>
          )
        })}
      </div>
    </section>
  )
}
