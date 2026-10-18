import { expect, test } from '@playwright/test';
import en from '../content/shop.en.json';
import zh from '../content/shop.zh-CN.json';
import fr from '../content/shop.fr.json';
import es from '../content/shop.es.json';
import type { ShopMessages } from '../lib/shop-i18n';

test.use({
  extraHTTPHeaders:
    process.env.E2E_STOREFRONT_PREVIEW === '1' ? { 'X-Shop-Preview': 'storefront-r20261018' } : {}
});
test('released four-language catalog: real content, SSR, preference, images and unchanged API data', async ({
  page
}) => {
  test.skip(
    process.env.E2E_COMMERCE_LANGUAGES_LIVE !== '1',
    'Explicit deployed language acceptance only.'
  );
  test.setTimeout(180000);
  const catalogs: Record<string, ShopMessages> = { en, 'zh-CN': zh, fr, es };
  type Product = { id: number; sku: string; name: string; description: string; price: number };
  let baseline: Product[] | undefined;
  await page.goto('/');
  for (const locale of ['zh-CN', 'fr', 'es', 'en']) {
    const dictionary = catalogs[locale]!;
    await page.locator('header .language-switcher select').selectOption(locale);
    await expect(page.locator('html')).toHaveAttribute('lang', locale);
    await expect(page).toHaveTitle(dictionary['Purelamp | Everyday finds'] as string);
    const [response, reload] = await Promise.all([
      page.waitForResponse((r) => new URL(r.url()).pathname === '/api/shop/products'),
      page.reload()
    ]);
    expect(response.status()).toBe(200);
    expect(await reload!.text()).toContain('lang="' + locale + '"');
    expect(reload!.headers()['cache-control']).toMatch(/private|no-store/);
    const products = (await response.json()).data as Product[];
    const original = products.map(({ id, sku, name, description, price }) => ({
      id,
      sku,
      name,
      description,
      price
    }));
    expect(products.length).toBeGreaterThan(0);
    if (baseline) expect(original).toEqual(baseline);
    else baseline = original;
    await expect(page.locator('article.product-card')).toHaveCount(products.length);
    for (const product of products) {
      const card = page
        .locator('article.product-card')
        .filter({ has: page.getByText(product.sku, { exact: true }) });
      const name = dictionary[`_product.${product.sku}.name:${product.name}`];
      const description = dictionary[`_product.${product.sku}.description:${product.description}`];
      expect(typeof name).toBe('string');
      expect(typeof description).toBe('string');
      await expect(card.locator('h3')).toHaveText(name as string);
      await expect(card.locator('.market-product-body > p')).toHaveText(description as string);
      await expect(card.locator('.market-price-line')).toContainText('CNY');
      const image = card.locator('.product-atlas');
      await image.scrollIntoViewIfNeeded();
      await expect
        .poll(() => image.evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth > 0))
        .toBe(true);
    }
    await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
    await page.setViewportSize({ width: 1280, height: 800 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true
    );
    await page.screenshot({
      path: `test-results/commerce-live-${locale}-desktop.png`,
      fullPage: true
    });
    await page.setViewportSize({ width: 390, height: 844 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true
    );
    await page.screenshot({
      path: `test-results/commerce-live-${locale}-mobile.png`,
      fullPage: true
    });
  }
});
