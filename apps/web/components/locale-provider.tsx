'use client';
import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';
import { createTranslator, localeCookie, type Locale } from '@toolkit/i18n';
import { chinese, english } from '@/lib/messages';

const Context = createContext<{
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: ReturnType<typeof createTranslator<typeof english>>;
} | null>(null);

export function LocaleProvider({
  initialLocale,
  children
}: {
  initialLocale: Locale;
  children: ReactNode;
}) {
  const [locale, updateLocale] = useState(initialLocale);
  const value = useMemo(
    () => ({
      locale,
      setLocale(next: Locale) {
        updateLocale(next);
        document.documentElement.lang = next;
        document.cookie = `${localeCookie}=${next}; Path=/; Max-Age=31536000; SameSite=Lax${location.protocol === 'https:' ? '; Secure' : ''}`;
      },
      t: createTranslator(english, chinese, locale)
    }),
    [locale]
  );
  return <Context.Provider value={value}>{children}</Context.Provider>;
}
export function useLocale() {
  const value = useContext(Context);
  if (!value) throw new Error('LocaleProvider is required');
  return value;
}
export function LanguageSwitcher() {
  const { locale, setLocale, t } = useLocale();
  return (
    <label className="language-switcher">
      <span className="sr-only">{t('Language')}</span>
      <select
        aria-label={t('Language')}
        value={locale}
        onChange={(event) => setLocale(event.target.value === 'zh-CN' ? 'zh-CN' : 'en')}
      >
        <option value="en">English</option>
        <option value="zh-CN">简体中文</option>
      </select>
    </label>
  );
}
