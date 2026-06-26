/**
 * Tooltip 简易提示组件。
 *
 * 纯 CSS 实现（group-hover / group-focus-within 显示），无第三方依赖。
 * 通过 cloneElement 将 aria-describedby 注入到触发元素，保证无障碍关联。
 */
import { cloneElement, isValidElement, useId, type ReactElement, type ReactNode } from 'react'
import { cn } from '@/lib/utils'

export interface TooltipProps {
  /** 提示内容 */
  content: string
  /** 触发元素（应为单个可聚焦元素，如 button） */
  children: ReactNode
}

export function Tooltip({ content, children }: TooltipProps) {
  const tipId = useId()
  const trigger = isValidElement(children)
    ? cloneElement(children as ReactElement<Record<string, unknown>>, {
        'aria-describedby': tipId,
      })
    : children

  return (
    <span className="group relative inline-flex">
      {trigger}
      <span
        role="tooltip"
        id={tipId}
        className={cn(
          'pointer-events-none absolute bottom-full left-1/2 z-20 mb-2 -translate-x-1/2',
          'max-w-xs whitespace-nowrap rounded-md border border-bass-border bg-bass-surface-2 px-2 py-1',
          'text-xs text-bass-text shadow-lg',
          'opacity-0 transition-opacity duration-150',
          'group-hover:opacity-100 group-focus-within:opacity-100',
        )}
      >
        {content}
      </span>
    </span>
  )
}
