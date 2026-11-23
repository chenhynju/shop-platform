/** Framework-neutral locale primitives. Product copy belongs to each consuming app. */
export const locales = ['en', 'zh-CN', 'fr', 'es'] as const;
export type Locale = (typeof locales)[number];
export const defaultLocale: Locale = 'en';
export const localeCookie = 'toolkit_locale';

export function resolveLocale(value: unknown): Locale {
  return typeof value === 'string' && locales.includes(value as Locale)
    ? (value as Locale)
    : defaultLocale;
}

export function createTranslator<const T extends Record<string, string>>(
  english: T,
  chinese: Record<keyof T, string>,
  locale: Locale
) {
  return (key: keyof T, values: Record<string, string | number> = {}): string => {
    const text = (locale === 'zh-CN' ? chinese[key] : english[key]) || english[key];
    return text.replace(/\{([a-zA-Z][a-zA-Z0-9_]*)\}/g, (placeholder, name: string) =>
      Object.prototype.hasOwnProperty.call(values, name) ? String(values[name]) : placeholder
    );
  };
}

export function formatDate(
  value: string | Date,
  locale: Locale,
  options: Intl.DateTimeFormatOptions = { year: 'numeric', month: 'short', day: 'numeric' }
): string {
  const date = new Date(value instanceof Date ? value.getTime() : value);
  return Number.isNaN(date.getTime()) ? '—' : new Intl.DateTimeFormat(locale, options).format(date);
}

export function formatNumber(value: number, locale: Locale, options?: Intl.NumberFormatOptions) {
  return Number.isFinite(value) ? new Intl.NumberFormat(locale, options).format(value) : '—';
}
