/**
 * 共享样式常量。
 *
 * 将多个组件重复定义的 Tailwind 类名与 SVG/Canvas 主题色抽取至此，
 * 统一管理、避免漂移。详见优化方案 P2-1。
 */

/**
 * 标准焦点环样式：键盘导航时显示 accent 色轮廓。
 *
 * 用于按钮、可点击卡片、拖拽区域等所有需要键盘可达的交互元素。
 * 配合 index.css 中的 `:focus-visible` 全局兜底，此处显式声明以保证
 * 视觉一致性与 ring-offset颜色正确（深色背景需 offset 到 bass-bg）。
 */
export const FOCUS_RING =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bass-bg'

/**
 * Canvas / SVG 绘制用主题色（与 tailwind.config 中 bass-* 颜色保持一致）。
 *
 * 用于 WaveformViewer（Canvas）与 CompressorPanel（SVG）的描边/填充色，
 * 避免在多处硬编码十六进制值导致主题调整时漏改。
 */
export const CANVAS_COLORS = {
  /** 主强调色（accent / 已播放波形 / 压缩曲线） */
  accent: '#facc15',
  /** 次要文字/线条（bass-muted） */
  muted: '#8a94a8',
  /** 边框色（bass-border） */
  border: '#243049',
  /** 网格辅助线 */
  grid: '#3a4760',
  /** 正增益色（均衡器柱状图） */
  positive: '#facc15',
  /** 负增益色（均衡器柱状图） */
  negative: '#3b82f6',
} as const
