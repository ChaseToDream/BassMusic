/**
 * ErrorBoundary 全局错误边界。
 *
 * 捕获子组件渲染期间的同步错误，展示友好的错误页面：
 * - 错误信息使用 role="alert" 便于屏幕阅读器即时播报；
 * - 开发环境展示错误堆栈摘要，便于调试；
 * - 提供"重新加载"按钮恢复应用。
 *
 * 注意：错误边界无法捕获事件回调、异步错误与 setTimeout 内的错误，
 * 此处主要保障渲染链路崩溃时仍有可用的兜底界面。
 */
import { Component, type ErrorInfo, type ReactNode } from 'react'

interface ErrorBoundaryProps {
  /** 被包裹的子树。 */
  children: ReactNode
}

interface ErrorBoundaryState {
  /** 是否已进入错误态。 */
  hasError: boolean
  /** 捕获到的错误对象。 */
  error: Error | null
}

/**
 * React 错误边界组件。
 * 通过 getDerivedStateFromError 切换为错误态，componentDidCatch 上报日志。
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false, error: null }

  /**
   * 渲染错误时切换为错误态，返回新的 state 触发重渲染。
   */
  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error }
  }

  /**
   * 错误边界生命周期：记录错误信息，便于后续排查。
   */
  componentDidCatch(error: Error, info: ErrorInfo): void {
    // 控制台输出错误与组件堆栈，生产环境可在此接入日志上报
    console.error('BassMusic 渲染错误：', error, info.componentStack)
  }

  /**
   * 重新加载当前页面以恢复应用初始状态。
   */
  private handleReload = (): void => {
    window.location.reload()
  }

  render(): ReactNode {
    if (!this.state.hasError) {
      return this.props.children
    }

    const { error } = this.state
    // 仅在开发环境展示具体错误信息，避免生产环境泄露实现细节
    const isDev = import.meta.env.DEV

    return (
      <div
        role="alert"
        className="flex min-h-screen items-center justify-center bg-bass-bg p-6 text-bass-text"
      >
        <div className="w-full max-w-md text-center">
          <h1 className="text-xl font-bold">应用出现错误</h1>
          <p className="mt-2 text-sm text-bass-muted">
            抱歉，应用遇到了意外错误。您可以尝试重新加载页面恢复使用。
          </p>

          {isDev && error ? (
            <pre className="mt-4 max-h-48 overflow-auto rounded-md border border-bass-border bg-bass-surface p-3 text-left text-xs text-red-300">
              {error.name}: {error.message}
              {error.stack ? `\n\n${error.stack}` : ''}
            </pre>
          ) : null}

          <button
            type="button"
            onClick={this.handleReload}
            className="mt-6 inline-flex items-center justify-center rounded-md bg-accent px-5 py-2.5 text-sm font-medium text-bass-bg hover:bg-accent-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bass-bg"
          >
            重新加载
          </button>
        </div>
      </div>
    )
  }
}

export default ErrorBoundary
