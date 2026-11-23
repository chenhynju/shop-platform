# @toolkit/i18n

Framework-neutral English-first locale and formatting primitives. No React, Next.js or authentication dependency. Consume the compiled `dist` package from any JavaScript application. Each application owns its typed message catalog. `resolveLocale` accepts `en`, `zh-CN`, `fr`, and `es`, defaulting to English; date/number helpers support those locales. The legacy two-catalog `createTranslator` provides English/Chinese named plain-text interpolation and English fallback for other locales. The commerce application owns its four-language dictionary and plural adapter. Use React's normal escaping, never insert translated values with HTML APIs.

Build with `pnpm --filter @toolkit/i18n build`. Run its Node tests with `pnpm --filter @toolkit/i18n test`. Root installation builds this package, and root development starts its TypeScript watcher. See docs/i18n.md for integration and isolated-pilot instructions.
