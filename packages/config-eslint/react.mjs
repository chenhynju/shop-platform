// React 项目专用：在 base 之上追加 hooks 规则（apps/web、packages/ui 使用）
import reactHooks from 'eslint-plugin-react-hooks';
import base from './base.mjs';

export default [
  ...base,
  {
    plugins: { 'react-hooks': reactHooks },
    rules: {
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn'
    }
  }
];
