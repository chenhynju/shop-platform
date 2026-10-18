import type { Locale } from '@toolkit/i18n';
import type { PromotionInfo } from '@repo/types';

// Dispatched on window after any cart mutation so the nav badge can refetch.
export const CART_CHANGED_EVENT = 'shop:cart-changed';

// 商品价格按人民币（分）定价与展示；英文界面沿用同一金额口径。
export function formatCents(cents: number, locale: Locale = 'en'): string {
  return locale === 'en'
    ? `¥${(cents / 100).toFixed(2)}`
    : new Intl.NumberFormat(locale, {
        style: 'currency',
        currency: 'CNY',
        currencyDisplay: 'narrowSymbol'
      }).format(cents / 100);
}

// Mirrors the promotion math of the order API so the cart page can show an estimate.
export function estimatePromoTotal(subtotal: number, promo: PromotionInfo | null): number {
  if (!promo) return subtotal;
  if (promo.type === 'FIXED_DISCOUNT') return Math.max(0, subtotal - promo.value);
  if (promo.type === 'PERCENT_OFF') return Math.round((subtotal * (100 - promo.value)) / 100);
  if (promo.threshold === null || subtotal >= promo.threshold) {
    return Math.max(0, subtotal - promo.value);
  }
  return subtotal;
}

export function describePromotion(
  promo: PromotionInfo,
  locale: Locale = 'en',
  t: (key: string, values: Record<string, string | number>) => string = (key, values) =>
    key.replace(/\{(\w+)\}/g, (_, k: string) => String(values[k]))
): string {
  if (promo.type === 'FIXED_DISCOUNT')
    return t('{amount} off your order', { amount: formatCents(promo.value, locale) });
  if (promo.type === 'PERCENT_OFF') return t('{percent}% off your order', { percent: promo.value });
  return promo.threshold === null
    ? t('{amount} off your order', { amount: formatCents(promo.value, locale) })
    : t('{amount} off orders over {threshold}', {
        amount: formatCents(promo.value, locale),
        threshold: formatCents(promo.threshold, locale)
      });
}
