/**
 * 应用根组件。
 *
 * 挂载 Studio 工作台页面，并包裹全局错误边界，
 * 确保子树渲染崩溃时仍可展示可用的兜底界面。
 */
import { ErrorBoundary } from '@/components/ErrorBoundary'
import { Studio } from '@/pages/Studio'

export default function App() {
  return (
    <ErrorBoundary>
      <Studio />
    </ErrorBoundary>
  )
}
