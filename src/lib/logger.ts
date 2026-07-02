/**
 * 统一日志工具。
 *
 * 开发环境输出到 console，生产环境静默（后续可在此接入日志上报服务）。
 * 所有日志带 `[BassMusic]` 前缀，便于在浏览器控制台过滤。
 *
 * 注意：DEV 标志在每次调用时读取（而非模块加载时），以便测试可动态切换。
 */

const PREFIX = '[BassMusic]'

export const logger = {
  /** 记录错误：开发环境输出到 console.error，生产环境可接入上报。 */
  error(message: string, ...args: unknown[]): void {
    if (import.meta.env.DEV) {
      console.error(PREFIX, message, ...args)
    }
    // TODO: 生产环境接入日志上报服务
  },

  /** 记录警告：开发环境输出到 console.warn。 */
  warn(message: string, ...args: unknown[]): void {
    if (import.meta.env.DEV) {
      console.warn(PREFIX, message, ...args)
    }
  },

  /** 记录信息：开发环境输出到 console.info。 */
  info(message: string, ...args: unknown[]): void {
    if (import.meta.env.DEV) {
      // eslint-disable-next-line no-console -- info 级别日志在 logger 模块中是合理的
      console.info(PREFIX, message, ...args)
    }
  },
}
