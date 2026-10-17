// 基础 ESLint 平坦配置：JS + TS 推荐规则、自定义规则、与 Prettier 兼容
import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';
import eslintConfigPrettier from 'eslint-config-prettier';
import noUntaggedConsole from './rules/no-untagged-console.mjs';

export default [
  {
    ignores: [
      'node_modules/**',
      'dist/**',
      '.next/**',
      '.turbo/**',
      'coverage/**',
      'playwright-report/**',
      'test-results/**'
    ]
  },
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  {
    plugins: {
      'repo-custom': {
        rules: { 'no-untagged-console': noUntaggedConsole }
      }
    },
    rules: {
      // 示例自定义规则：console 调用必须带 [tag] 前缀，让日志可过滤、可归属
      'repo-custom/no-untagged-console': 'error'
    }
  },
  eslintConfigPrettier
];
