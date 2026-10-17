# @toolkit/i18n

Framework-neutral English-first English/Chinese primitives. No React, Next.js or authentication dependency. Consume the compiled `dist` package from any JavaScript application. Each application owns its typed message catalog. `resolveLocale` accepts only `en` and `zh-CN`, defaulting to English; `createTranslator` provides named plain-text interpolation and English fallback. Use React's normal escaping, never insert translated values with HTML APIs.

Build with `pnpm --filter @toolkit/i18n build`. Run its Node tests with `pnpm --filter @toolkit/i18n test`. Root installation builds this package, and root development starts its TypeScript watcher. See docs/i18n.md for integration and isolated-pilot instructions.
