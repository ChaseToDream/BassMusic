/**
 * Studio 三栏响应式布局骨架。
 *
 * 桌面（≥1280px）：左（上传/预设）｜中（波形/播放器）｜右（参数面板）；
 * 平板（768-1279px）：左右两栏置顶，参数面板移至下方三列；
 * 手机（<768px）：单列垂直堆叠。
 */
import type { ReactNode } from 'react'

import { cn } from '@/lib/utils'
import { useAudioStore } from '@/store/useAudioStore'

export interface StudioLayoutProps {
  /** 左栏内容：上传与预设。 */
  left: ReactNode
  /** 中栏内容：波形与播放器。 */
  center: ReactNode
  /** 右栏内容：参数面板。 */
  right: ReactNode
}

export default function StudioLayout({ left, center, right }: StudioLayoutProps) {
  const audioBuffer = useAudioStore((s) => s.audioBuffer)
  const hasBuffer = Boolean(audioBuffer)

  return (
    <main
      id="main-content"
      tabIndex={-1}
      className="mx-auto max-w-[1600px] px-4 py-6 outline-none"
    >
      <div className="grid grid-cols-1 items-start gap-4 md:grid-cols-[320px_1fr] xl:grid-cols-[320px_1fr_360px]">
        {/* 左栏：上传 + 预设 */}
        <div className="flex flex-col gap-4">{left}</div>

        {/* 中栏：波形可视化 + 预览播放器 */}
        <div className="flex flex-col gap-4">{center}</div>

        {/* 右栏：参数面板。无音频时灰显 */}
        <div
          className={cn(
            'grid grid-cols-1 gap-4 md:col-span-2 md:grid-cols-3 xl:col-span-1 xl:grid-cols-1',
            !hasBuffer && 'pointer-events-none select-none opacity-40',
          )}
          aria-disabled={!hasBuffer}
        >
          {right}
        </div>
      </div>
    </main>
  )
}
