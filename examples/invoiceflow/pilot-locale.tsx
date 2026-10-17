'use client';
import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';
import { createTranslator, localeCookie, type Locale } from '@toolkit/i18n';
import chinese from './pilot-messages.json';
const english = Object.fromEntries(Object.keys(chinese).map((key) => [key, key])) as Record<
  keyof typeof chinese,
  string
>;
const reverse = new Map(Object.entries(chinese).map(([key, value]) => [value, key]));
const Context = createContext<{
  locale: Locale;
  t: (key: string, values?: Record<string, string | number>) => string;
} | null>(null);
export function PilotLocaleProvider({
  initialLocale,
  children
}: {
  initialLocale: Locale;
  children: ReactNode;
}) {
  const [locale, setLocale] = useState(initialLocale);
  const value = useMemo(
    () => ({
      locale,
      t(key: string, values?: Record<string, string | number>) {
        const normalized = reverse.get(key) ?? key;
        return Object.hasOwn(english, normalized)
          ? createTranslator(english, chinese, locale)(normalized as keyof typeof chinese, values)
          : key;
      }
    }),
    [locale]
  );
  return (
    <Context.Provider value={value}>
      <div className="flex justify-end border-b bg-white px-6 py-2">
        <label className="text-sm">
          <span className="sr-only">{value.t('Language')}</span>
          <select
            aria-label={value.t('Language')}
            value={locale}
            onChange={(event) => {
              const next = event.target.value === 'zh-CN' ? 'zh-CN' : 'en';
              setLocale(next);
              document.documentElement.lang = next;
              document.cookie = `${localeCookie}=${next}; Path=/; Max-Age=31536000; SameSite=Lax${location.protocol === 'https:' ? '; Secure' : ''}`;
            }}
            className="rounded border px-3 py-1"
          >
            <option value="en">English</option>
            <option value="zh-CN">简体中文</option>
          </select>
        </label>
      </div>
      {children}
    </Context.Provider>
  );
}
export function usePilotLocale() {
  const context = useContext(Context);
  if (!context) throw Error('PilotLocaleProvider required');
  return context;
}
