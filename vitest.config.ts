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
  },
})
