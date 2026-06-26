/**
 * Switch 开关组件。
 *
 * 封装为 button + role="switch"，原生 button 默认支持 Space/Enter 触发点击，
 * 因此无需手动处理键盘事件。
 */
import { cn } from '@/lib/utils'

export interface SwitchProps {
  /** 标签文字 */
  label: string
  /** 是否开启 */
  checked: boolean
  /** 切换回调 */
  onChange: (checked: boolean) => void
  /** 关联描述元素 id（无障碍） */
  describedById?: string
}

export function Switch({ label, checked, onChange, describedById }: SwitchProps) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-sm font-medium text-bass-text">{label}</span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        aria-describedby={describedById}
        onClick={() => onChange(!checked)}
        className={cn(
          'relative h-6 w-11 shrink-0 rounded-full transition-colors',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bass-bg',
          checked ? 'bg-accent' : 'bg-bass-border',
        )}
      >
        <span
          aria-hidden="true"
          className={cn(
            'absolute left-0.5 top-0.5 h-5 w-5 rounded-full shadow transition-transform',
            checked ? 'translate-x-5 bg-bass-bg' : 'translate-x-0 bg-bass-text',
          )}
        />
      </button>
    </div>
  )
}
