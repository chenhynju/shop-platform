import { describe, expect, it } from 'vitest';
import { locales, resolveLocale } from '@toolkit/i18n';
import { translateShop, type ShopMessages } from '../lib/shop-i18n';
import { formatCents } from '../lib/shop';
import { localizeError } from '../lib/localize-error';
import { RequestError } from '../lib/api';
import en from '../content/shop.en.json';
import zh from '../content/shop.zh-CN.json';
import fr from '../content/shop.fr.json';
import es from '../content/shop.es.json';

const catalogs: Record<string, ShopMessages> = { en, 'zh-CN': zh, fr, es };
describe('four-language commerce messages', () => {
  it('covers every message and preserves all named placeholders in every language and plural form', () => {
    for (const locale of locales) {
      expect(resolveLocale(locale)).toBe(locale);
      const messages = catalogs[locale]!;
      expect(Object.keys(messages).sort()).toEqual(Object.keys(en).sort());
      for (const [key, value] of Object.entries(messages)) {
        const placeholders = (text: string) =>
          [...text.matchAll(/\{([a-zA-Z][a-zA-Z0-9_]*)\}/g)].map((x) => x[1]).sort();
        for (const text of typeof value === 'string' ? [value] : [value.one, value.other]) {
          expect(text.trim().length, key + ' ' + locale).toBeGreaterThan(0);
          // Product-content keys include a source value, with no interpolation.
          expect(placeholders(text), key + ' ' + locale).toEqual(placeholders(key));
        }
      }
    }
  });
  it('handles singular/plural counts and explicit missing-key fallback', () => {
    expect(translateShop('en', en, '{count} products', { count: 1 })).toBe('1 product');
    expect(translateShop('en', en, '{count} products', { count: 2 })).toBe('2 products');
    expect(translateShop('fr', fr, '{count} products', { count: 1 })).toBe('1 produit');
    expect(translateShop('es', es, '{count} products', { count: 2 })).toBe('2 productos');
    expect(translateShop('zh-CN', zh, '{count} products', { count: 0 })).toBe('0 件商品');
    expect(translateShop('fr', {}, 'Missing {name}', { name: 'SKU-01' })).toBe('Missing SKU-01');
    expect(translateShop('fr', {}, 'toString')).toBe('toString');
    expect(translateShop('fr', {}, '__proto__')).toBe('__proto__');
  });
  it('keeps user content as plain strings and localizes API errors by code', () => {
    const t = (key: string, values?: Record<string, string | number>) =>
      translateShop('es', es, key, values);
    expect(t('Results for “{query}”', { query: '<img src=x onerror=alert(1)>' })).toContain(
      '<img src=x onerror=alert(1)>'
    );
    expect(
      localizeError(
        new RequestError('Internal English details', 'INVALID_CREDENTIALS', 'request-1'),
        'es',
        t
      )
    ).toBe('El correo electrónico o la contraseña son incorrectos. · Solicitud request-1');
  });
  it('changes money formatting without currency conversion or SKU/content mutation', () => {
    expect(formatCents(12900)).toBe('¥129.00');
    expect(formatCents(12900, 'fr')).toContain('129,00');
    expect(formatCents(12900, 'es')).toContain('129,00');
    const product = { sku: 'KB-87', price: 12900, name: 'Mechanical Keyboard' };
    expect(fr['_product.KB-87.name:Mechanical Keyboard']).toBe('Clavier mécanique');
    expect(product).toEqual({ sku: 'KB-87', price: 12900, name: 'Mechanical Keyboard' });
  });
});
