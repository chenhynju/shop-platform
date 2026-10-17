// 自定义 ESLint 规则示例：no-untagged-console
// 要求 console.* 的第一个参数必须是形如 "[tag]" 的字符串字面量，
// 使日志可被 grep/过滤，并明确归属（如 "[api]"、"[web]"、"[db]"）。
//
// 规则 ID：repo-custom/no-untagged-console
// 合法：console.log('[api] listening', { port })
// 非法：console.log('listening', { port })

/** @type {import('eslint').Rule.RuleModule} */
const noUntaggedConsole = {
  meta: {
    type: 'suggestion',
    docs: {
      description: 'console 调用必须以 [tag] 字符串字面量开头',
      recommended: true
    },
    messages: {
      tagged: 'Console 调用必须以 [tag] 开头，例如 console.log("[api] ...")'
    },
    schema: []
  },
  create(context) {
    return {
      CallExpression(node) {
        const callee = node.callee;
        const isConsole =
          callee.type === 'MemberExpression' &&
          callee.object.type === 'Identifier' &&
          callee.object.name === 'console';
        if (!isConsole) {
          return;
        }
        const firstArg = node.arguments[0];
        const hasTag =
          firstArg &&
          firstArg.type === 'Literal' &&
          typeof firstArg.value === 'string' &&
          /^\[[\w-]+\]/.test(firstArg.value);
        if (!hasTag) {
          context.report({ node, messageId: 'tagged' });
        }
      }
    };
  }
};

export default noUntaggedConsole;
