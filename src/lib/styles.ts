/**
 * 共享样式常量。
 *
 * 将多个组件重复定义的 Tailwind 类名抽取至此，统一管理、避免漂移。
 * 详见优化方案 P2-1。
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
