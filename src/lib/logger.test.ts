/**
 * logger 单元测试
 *
 * 验证：
 * - 开发环境下 error/warn/info 分别调用对应 console 方法
 * - 日志带 [BassMusic] 前缀
 * - 参数正确透传
 * - 生产环境静默
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

import { logger } from './logger'

describe('logger', () => {
  beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    vi.spyOn(console, 'info').mockImplementation(() => {})
  })

  afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllEnvs()
  })

  it('开发环境 error 调用 console.error 并带前缀', () => {
    vi.stubEnv('DEV', true)
    logger.error('测试错误', { code: 1 })
    expect(console.error).toHaveBeenCalledWith('[BassMusic]', '测试错误', { code: 1 })
  })

  it('开发环境 warn 调用 console.warn 并带前缀', () => {
    vi.stubEnv('DEV', true)
    logger.warn('测试警告')
    expect(console.warn).toHaveBeenCalledWith('[BassMusic]', '测试警告')
  })

  it('开发环境 info 调用 console.info 并带前缀', () => {
    vi.stubEnv('DEV', true)
    logger.info('测试信息', 'extra')
    expect(console.info).toHaveBeenCalledWith('[BassMusic]', '测试信息', 'extra')
  })

  it('生产环境不输出任何日志', () => {
    vi.stubEnv('DEV', false)
    logger.error('不应输出')
    logger.warn('不应输出')
    logger.info('不应输出')
    expect(console.error).not.toHaveBeenCalled()
    expect(console.warn).not.toHaveBeenCalled()
    expect(console.info).not.toHaveBeenCalled()
  })

  it('支持多参数透传', () => {
    vi.stubEnv('DEV', true)
    const obj = { a: 1 }
    const arr = [1, 2, 3]
    logger.error('多参数', obj, arr, 42, true)
    expect(console.error).toHaveBeenCalledWith('[BassMusic]', '多参数', obj, arr, 42, true)
  })
})
