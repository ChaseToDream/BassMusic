/**
 * Vitest 全局测试环境初始化。
 *
 * 职责：
 * 1. 注入 jsdom 缺失的浏览器 API（matchMedia / ResizeObserver / IntersectionObserver）
 * 2. 每个测试后自动清理 @testing-library/react 挂载的组件
 * 3. 扩展 vitest 的 expect 断言（jest-dom）
 *
 * 注意：AudioContext 的 mock 由各测试文件按需提供（通过 vi.stubGlobal 或局部 mock），
 * 此处不统一 stub，避免影响现有音频模块测试的真实行为。
 */
import '@testing-library/jest-dom/vitest'
import { afterEach, vi } from 'vitest'
import { cleanup } from '@testing-library/react'

// 每个测试用例后清理挂载的组件，避免泄漏
afterEach(() => {
  cleanup()
})

// matchMedia：jsdom 不实现，部分 UI 库或组件可能调用
if (!window.matchMedia) {
  window.matchMedia = vi.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(), // 已废弃但保留兼容
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  }))
}

// ResizeObserver：WaveformViewer 依赖，jsdom 不实现
if (!global.ResizeObserver) {
  global.ResizeObserver = vi.fn().mockImplementation(() => ({
    observe: vi.fn(),
    unobserve: vi.fn(),
    disconnect: vi.fn(),
  }))
}

// IntersectionObserver：预留，部分场景可能使用
if (!global.IntersectionObserver) {
  global.IntersectionObserver = vi.fn().mockImplementation(() => ({
    observe: vi.fn(),
    unobserve: vi.fn(),
    disconnect: vi.fn(),
    takeRecords: vi.fn(() => []),
    root: null,
    rootMargin: '',
    thresholds: [],
  }))
}

// requestAnimationFrame / cancelAnimationFrame：jsdom 有实现但无真实帧调度，
// 测试中如需控制帧可通过 vi.useFakeTimers() 替换。此处确保存在避免 undefined。
if (!global.requestAnimationFrame) {
  global.requestAnimationFrame = vi.fn((cb: FrameRequestCallback) => {
    return setTimeout(() => cb(performance.now()), 0) as unknown as number
  })
}
if (!global.cancelAnimationFrame) {
  global.cancelAnimationFrame = vi.fn((id: number) => {
    clearTimeout(id as unknown as ReturnType<typeof setTimeout>)
  })
}
