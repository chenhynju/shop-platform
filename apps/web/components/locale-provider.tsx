'use client';
import { createContext, useContext, useMemo, useEffect, type ReactNode } from 'react';
import { createTranslator, localeCookie, resolveLocale, type Locale } from '@toolkit/i18n';
import { useRouter } from 'next/navigation';
import { translateShop, type ShopMessages } from '@/lib/shop-i18n';
import { chinese, english } from '@/lib/messages';

const Context = createContext<{
  locale: Locale;
  setLocale: (locale: Locale) => void;
  st: (key: string, values?: Record<string, string | number>) => string;
  sample: (sku: string, field: 'name' | 'description', original: string) => string;
  t: ReturnType<typeof createTranslator<typeof english>>;
} | null>(null);

export function LocaleProvider({
  initialLocale,
  commerceMessages,
  children
}: {
  initialLocale: Locale;
  commerceMessages: ShopMessages;
  children: ReactNode;
}) {
  const locale = initialLocale;
  const router = useRouter();
  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);
  const value = useMemo(
    () => ({
      locale,
      setLocale(next: Locale) {
        document.cookie = `${localeCookie}=${next}; Path=/; Max-Age=31536000; SameSite=Lax${location.protocol === 'https:' ? '; Secure' : ''}`;
        router.refresh();
      },
      st: (key: string, values?: Record<string, string | number>) =>
        translateShop(locale, commerceMessages, key, values),
      sample: (sku: string, field: 'name' | 'description', original: string) => {
        const key = `_product.${sku}.${field}:${original}`;
        const value = Object.hasOwn(commerceMessages, key) ? commerceMessages[key] : undefined;
        return typeof value === 'string' ? value : original;
      },
      t: createTranslator(english, chinese, locale)
    }),
    [locale, commerceMessages, router]
  );
  return <Context.Provider value={value}>{children}</Context.Provider>;
}
export function useLocale() {
  const value = useContext(Context);
  if (!value) throw new Error('LocaleProvider is required');
  return value;
}
export function LanguageSwitcher() {
  const { locale, setLocale, st: t } = useLocale();
  return (
    <label className="language-switcher">
      <span className="sr-only">{t('Language')}</span>
      <select
        aria-label={t('Language')}
        value={locale}
        onChange={(event) => setLocale(resolveLocale(event.target.value))}
      >
        <option value="en">English</option>
        <option value="zh-CN">简体中文</option>
        <option value="fr">Français</option>
        <option value="es">Español</option>
      </select>
    </label>
  );
}
