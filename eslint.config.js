// ESLint 9 flat config —— BassMusic 项目代码规范
// 详见优化方案 P2-1
import js from '@eslint/js'
import tseslint from 'typescript-eslint'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import prettierConfig from 'eslint-config-prettier'

export default tseslint.config(
  // 全局忽略
  {
    ignores: ['dist/**', 'node_modules/**', 'coverage/**', '*.config.js', '*.config.ts'],
  },

  // 基础推荐规则
  js.configs.recommended,

  // TypeScript 推荐规则（非 type-checked，避免阻塞存量；后续可逐步启用 type-checked）
  ...tseslint.configs.recommended,

  // 项目源码规则
  {
    files: ['src/**/*.{ts,tsx}'],
    plugins: {
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
    },
    rules: {
      // React Hooks 规则（必须，捕获依赖缺失等常见错误）
      ...reactHooks.configs.recommended.rules,

      // 以下规则在 react-hooks v7（面向 React 19 Compiler）中为 error，
      // 但本项目使用 React 18，这些模式是官方推荐的安全写法，关闭以避免误报：
      // - set-state-in-effect：受控组件同步外部值到内部 state 的常见模式
      // - refs：事件监听器通过 ref 读取最新值避免重新订阅的官方推荐模式
      // - immutability：单例对象（如 AudioProcessor）属性赋值被误判为修改 state
      'react-hooks/set-state-in-effect': 'off',
      'react-hooks/refs': 'off',
      'react-hooks/immutability': 'off',

      // React Refresh：仅导出组件的文件才能热更新（允许常量导出）
      'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],

      // 未使用变量报错，但允许下划线前缀的占位参数
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrorsIgnorePattern: '^_' },
      ],

      // 允许 any（项目中存在少量 any，后续逐步收窄）
      '@typescript-eslint/no-explicit-any': 'off',

      // 使用 console.error（ErrorBoundary 日志）允许，其他 console 警告
      'no-console': ['warn', { allow: ['error', 'warn'] }],

      // 禁止 var
      'no-var': 'error',
      'prefer-const': 'error',
    },
  },

  // 测试文件放宽规则
  {
    files: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
      'no-console': 'off',
    },
  },

  // 关闭与 Prettier 冲突的格式化规则
  prettierConfig,
)
