import { expect, test } from '@playwright/test';
import { randomBytes } from 'node:crypto';

test.use({
  extraHTTPHeaders:
    process.env.E2E_STOREFRONT_PREVIEW === '1' ? { 'X-Shop-Preview': 'storefront-r20261018' } : {}
});

test('released storefront: real catalog, search, guest protection and account navigation', async ({
  page,
  baseURL
}) => {
  test.skip(
    process.env.E2E_STOREFRONT_LIVE !== '1',
    'Explicit deployed storefront acceptance only.'
  );
  const [response] = await Promise.all([
    page.waitForResponse((response) => new URL(response.url()).pathname === '/api/shop/products'),
    page.goto('/')
  ]);
  expect(response.status()).toBe(200);
  const products = (await response.json()).data as { sku: string; name: string; price: number }[];
  await expect(page).toHaveTitle('Purelamp | Everyday finds');
  await expect(page.getByRole('heading', { name: 'Your everyday, upgraded.' })).toBeVisible();
  await expect(page.locator('article.product-card')).toHaveCount(products.length);
  if (products.length) {
    const product = products[0]!;
    await page.getByRole('searchbox', { name: 'Search products' }).fill(product.sku);
    await page.getByRole('searchbox', { name: 'Search products' }).press('Enter');
    await expect(page.locator('article.product-card h3').first()).toHaveText(product.name);
    await page.getByRole('searchbox', { name: 'Search products' }).fill('');
    await page.getByRole('searchbox', { name: 'Search products' }).press('Enter');
    await expect(page.locator('article.product-card')).toHaveCount(products.length);
  }
  expect(await page.evaluate(async () => (await fetch('/api/shop/cart')).status)).toBe(401);
  expect(await page.evaluate(async () => (await fetch('/api/shop/orders')).status)).toBe(401);
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
  await page.screenshot({ path: 'test-results/storefront-deployed-desktop.png', fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: 'test-results/storefront-deployed-mobile.png', fullPage: true });
  await page.getByRole('link', { name: 'Account', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Sign in to continue' })).toBeVisible();
  await page.getByRole('button', { name: 'New here? Create account', exact: true }).click();
  await expect(page.getByLabel('Your name')).toBeVisible();
  await page.getByRole('button', { name: 'Already have an account? Sign in', exact: true }).click();
  // A localhost preview tunnel is not the API's configured production Origin.
  if (baseURL?.startsWith('https://shop.purelamp.uk')) {
    await page.getByLabel('Email address').fill('storefront-invalid-login@example.test');
    await page.getByLabel('Password', { exact: true }).fill('invalid-login-password-2026');
    await page.getByRole('button', { name: 'Sign in', exact: true }).click();
    await expect(page.locator('main [role=alert]')).toContainText(
      'Email or password is incorrect.'
    );
  }
  await page.goto('/workspace');
  await expect(
    page.getByRole('heading', { name: 'Start strong. Build what matters.' })
  ).toBeVisible();
});

test('released account: real registration, private cart, logout and login', async ({ page }) => {
  test.skip(
    process.env.E2E_STOREFRONT_ACCOUNT !== '1',
    'Explicit disposable account acceptance only.'
  );
  const email = `storefront-acceptance-${Date.now()}-${randomBytes(3).toString('hex')}@example.test`;
  const password = randomBytes(24).toString('base64url');
  // The password stays in process memory; this marker identifies the disposable fixture for cleanup.
  console.log('[storefront-test] Disposable account fixture:', email);
  const [catalogResponse] = await Promise.all([
    page.waitForResponse((response) => new URL(response.url()).pathname === '/api/shop/products'),
    page.goto('/')
  ]);
  expect(catalogResponse.status()).toBe(200);
  const products = (await catalogResponse.json()).data as {
    sku: string;
    name: string;
    stock: number;
  }[];
  const product = products.find((item) => item.stock > 0);
  expect(product, 'An in-stock sample product is required').toBeTruthy();
  await page.goto('/account');
  await page.getByRole('button', { name: 'New here? Create account', exact: true }).click();
  await page.getByLabel('Your name').fill('Storefront acceptance');
  await page.getByLabel('Email address').fill(email);
  await page.getByLabel('Password', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Create account', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Welcome, Storefront acceptance' })).toBeVisible();
  await page.goto('/');
  const card = page
    .locator('article.product-card')
    .filter({ has: page.getByRole('heading', { name: product!.name, exact: true }) });
  await card.getByRole('button', { name: '+ Add to cart', exact: true }).click();
  await expect(page.getByRole('status')).toContainText(`${product!.name} added to your cart.`);
  await page
    .getByRole('navigation', { name: 'Shop navigation' })
    .getByRole('link', { name: /^Cart/ })
    .click();
  await expect(page.getByRole('heading', { name: 'Your cart', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Increase ' + product!.name, exact: true }).click();
  await expect(page.locator('.stepper span')).toHaveText('2');
  await page.goto('/account');
  await page.getByRole('button', { name: 'Sign out', exact: true }).click();
  expect(await page.evaluate(async () => (await fetch('/api/shop/cart')).status)).toBe(401);
  await page.getByLabel('Email address').fill(email);
  await page.getByLabel('Password', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Welcome, Storefront acceptance' })).toBeVisible();
  await page.goto('/shop/cart');
  await expect(page.locator('.stepper span')).toHaveText('2');
  await page.getByRole('button', { name: 'Remove', exact: true }).click();
  await expect(page.getByText('Your cart is empty', { exact: true })).toBeVisible();
  await page.goto('/account');
  await page.getByRole('button', { name: 'Sign out', exact: true }).click();
});
