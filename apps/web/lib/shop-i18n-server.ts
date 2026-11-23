import 'server-only';
import { cookies } from 'next/headers';
import { localeCookie, resolveLocale } from '@toolkit/i18n';
import en from '@/content/shop.en.json';
import zh from '@/content/shop.zh-CN.json';
import fr from '@/content/shop.fr.json';
import es from '@/content/shop.es.json';
import { translateShop, type ShopMessages } from './shop-i18n';
export async function shopLocale() {
  const locale = resolveLocale((await cookies()).get(localeCookie)?.value);
  const messages: ShopMessages = { en, 'zh-CN': zh, fr, es }[locale];
  return {
    locale,
    messages,
    t: (key: string, values?: Record<string, string | number>) =>
      translateShop(locale, messages, key, values)
  };
}
