import type { PromotionInfo } from '@repo/types';

// Dispatched on window after any cart mutation so the nav badge can refetch.
export const CART_CHANGED_EVENT = 'shop:cart-changed';

export function formatCents(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
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

export function describePromotion(promo: PromotionInfo): string {
  if (promo.type === 'FIXED_DISCOUNT') return `${formatCents(promo.value)} off your order`;
  if (promo.type === 'PERCENT_OFF') return `${promo.value}% off your order`;
  return promo.threshold === null
    ? `${formatCents(promo.value)} off your order`
    : `${formatCents(promo.value)} off orders over ${formatCents(promo.threshold)}`;
}
