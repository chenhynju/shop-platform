import { FlatCompat } from '@eslint/eslintrc';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import base from '@repo/config-eslint/base.mjs';

// eslint-config-next 15.x 提供的仍是 eslintrc 风格配置，
// 通过 FlatCompat 转换为 flat config（Next.js 官方文档的推荐写法）。
// 注意：不引入 next/typescript —— 其 TS 规则与 base 中的 typescript-eslint
// 重复注册插件导致冲突，base 已覆盖同等规则。
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const compat = new FlatCompat({ baseDirectory: __dirname });

// 注意：ESLint 9 的 ignores 相对于「定义它的配置文件所在目录」解析，
// base.mjs 位于 packages/config-eslint，故各包需在此声明自己的忽略项
const localIgnores = [
  {
    ignores: [
      'node_modules/**',
      'dist/**',
      '.next/**',
      'coverage/**',
      'playwright-report/**',
      'test-results/**',
      'next-env.d.ts'
    ]
  }
];

const config = [...localIgnores, ...base, ...compat.extends('next/core-web-vitals')];

export default config;
