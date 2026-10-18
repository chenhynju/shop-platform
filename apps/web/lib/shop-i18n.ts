import type { Locale } from '@toolkit/i18n';
export type ShopMessage = string | { one: string; other: string };
export type ShopMessages = Record<string, ShopMessage>;
export function translateShop(
  locale: Locale,
  messages: ShopMessages,
  key: string,
  values: Record<string, string | number> = {}
): string {
  const entry = Object.hasOwn(messages, key) ? messages[key] : key;
  const text =
    typeof entry === 'string'
      ? entry
      : entry
        ? entry[
            typeof values.count === 'number' &&
            new Intl.PluralRules(locale).select(values.count) === 'one'
              ? 'one'
              : 'other'
          ]
        : key;
  return text.replace(/\{([a-zA-Z][a-zA-Z0-9_]*)\}/g, (placeholder, name: string) =>
    Object.hasOwn(values, name) ? String(values[name]) : placeholder
  );
}
