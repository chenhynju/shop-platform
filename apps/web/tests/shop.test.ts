import { describe, expect, it } from 'vitest';
import type { PromotionInfo } from '@repo/types';
import { describePromotion, estimatePromoTotal, formatCents } from '../lib/shop';

const promo = (over: Partial<PromotionInfo>): PromotionInfo => ({
  code: 'X',
  type: 'FIXED_DISCOUNT',
  value: 1000,
  threshold: null,
  active: true,
  ...over
});

describe('formatCents', () => {
  it('formats yuan with two decimals', () => {
    expect(formatCents(12900)).toBe('¥129.00');
    expect(formatCents(50)).toBe('¥0.50');
    expect(formatCents(0)).toBe('¥0.00');
  });
});

describe('estimatePromoTotal', () => {
  it('returns subtotal without promo', () => {
    expect(estimatePromoTotal(5000, null)).toBe(5000);
  });

  it('applies fixed discount', () => {
    expect(estimatePromoTotal(5000, promo({ type: 'FIXED_DISCOUNT', value: 1000 }))).toBe(4000);
  });

  it('applies percent off', () => {
    expect(estimatePromoTotal(5000, promo({ type: 'PERCENT_OFF', value: 10 }))).toBe(4500);
  });

  it('applies full reduction only when threshold is met', () => {
    expect(
      estimatePromoTotal(30000, promo({ type: 'FULL_REDUCTION', value: 5000, threshold: 30000 }))
    ).toBe(25000);
    expect(
      estimatePromoTotal(29999, promo({ type: 'FULL_REDUCTION', value: 5000, threshold: 30000 }))
    ).toBe(29999);
  });
});

describe('describePromotion', () => {
  it('describes fixed discount', () => {
    expect(describePromotion(promo({ type: 'FIXED_DISCOUNT', value: 2000 }))).toBe(
      '¥20.00 off your order'
    );
  });

  it('describes percent off', () => {
    expect(describePromotion(promo({ type: 'PERCENT_OFF', value: 10 }))).toBe('10% off your order');
  });

  it('describes full reduction with threshold', () => {
    expect(
      describePromotion(promo({ type: 'FULL_REDUCTION', value: 5000, threshold: 30000 }))
    ).toBe('¥50.00 off orders over ¥300.00');
  });
});
