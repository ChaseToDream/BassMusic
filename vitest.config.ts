import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import path from 'node:path'

// https://vitest.dev/config/
// 独立于 vite.config.ts：显式声明测试环境与别名，避免依赖 vite 配置的合并行为。
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },
  test: {
    // jsdom 提供 window / File / Blob / DOMException 等浏览器全局对象。
    environment: 'jsdom',
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
    // 全局测试初始化：注入 jsdom 缺失的 API、jest-dom 断言扩展、组件清理
    setupFiles: ['./src/test/setup.ts'],
    // 允许直接使用 describe/it/expect 等，无需每个文件 import
    globals: true,
    // 覆盖率配置：当前基线为组件层未覆盖、lib/store 层充分覆盖，
    // 阈值设为略低于当前水平，作为回归保护，后续随组件测试补充逐步提高
    coverage: {
      provider: 'v8',
      reporter: ['text', 'text-summary', 'html'],
      reportsDirectory: './coverage',
      include: ['src/**/*.{ts,tsx}'],
      exclude: [
        'src/**/*.test.{ts,tsx}',
        'src/**/*.spec.{ts,tsx}',
        'src/test/**',
        'src/main.tsx',
        'src/vite-env.d.ts',
        'src/**/index.ts',
      ],
      thresholds: {
        lines: 35,
        functions: 30,
        branches: 15,
        statements: 35,
      },
    },
  },
})
