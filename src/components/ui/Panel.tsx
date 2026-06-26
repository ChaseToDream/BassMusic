import type { ReactNode } from 'react'

import { cn } from '@/lib/utils'

export interface PanelProps {
  /** 面板标题 */
  title?: string
  /** 标题前图标（任意 ReactNode，通常为 lucide 图标） */
  icon?: ReactNode
  /** 右上角操作区 */
  actions?: ReactNode
  /** 面板内容 */
  children: ReactNode
  /** 附加在根节点的类名 */
  className?: string
  /** 附加在内容容器的类名 */
  bodyClassName?: string
}

/**
 * 通用面板容器：统一深色表面、圆角与边框，
 * 提供标题栏（含图标与操作区）与内容区。
 */
export function Panel({
  title,
  icon,
  actions,
  children,
  className,
  bodyClassName,
}: PanelProps) {
  return (
    <section
      className={cn(
        'flex flex-col rounded-lg border border-bass-border bg-bass-surface',
        className,
      )}
    >
      {(title != null || icon != null || actions != null) && (
        <header className="flex items-center justify-between gap-3 border-b border-bass-border px-4 py-3">
          <div className="flex items-center gap-2">
            {icon != null && (
              <span className="text-accent" aria-hidden="true">
                {icon}
              </span>
            )}
            {title != null && (
              <h2 className="text-base font-semibold text-bass-text">
                {title}
              </h2>
            )}
          </div>
          {actions != null && (
            <div className="flex items-center gap-2">{actions}</div>
          )}
        </header>
      )}
      <div className={cn('flex-1 p-4', bodyClassName)}>{children}</div>
    </section>
  )
}

export default Panel
