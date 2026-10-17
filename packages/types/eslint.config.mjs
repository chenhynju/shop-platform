import base from '@repo/config-eslint/base.mjs';

// ignores 相对于本配置文件所在目录（ESLint 9 语义）
const localIgnores = [{ ignores: ['node_modules/**', 'dist/**', 'coverage/**'] }];

const config = [...localIgnores, ...base];

export default config;
