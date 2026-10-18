import { expect, test } from '@playwright/test';

const products = [
  {
    id: 1,
    sku: 'UI-KEYBOARD',
    name: 'Mechanical keyboard',
    description: 'Compact desk companion',
    price: 12900,
    stock: 4,
    status: 'ACTIVE'
  },
  {
    id: 2,
    sku: 'UI-MOUSE',
    name: 'Wireless mouse',
    description: 'Everyday comfort',
    price: 5900,
    stock: 0,
    status: 'ACTIVE'
  },
  {
    id: 3,
    sku: 'UI-HEADPHONES',
    name: 'Studio headphones',
    description: 'For your favorite sounds',
    price: 19900,
    stock: 8,
    status: 'ACTIVE'
  }
];

test('storefront UI: catalog, search, sorting, availability and mobile layout', async ({
  page
}) => {
  await page.route('**/api/**', async (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path === '/api/shop/products') return route.fulfill({ json: { data: products } });
    return route.fulfill({
      status: 401,
      json: { error: { code: 'UNAUTHORIZED', message: 'Sign in required' } }
    });
  });
  await page.goto('/');
  await expect(page).toHaveTitle('Purelamp | Everyday finds');
  await expect(page.getByRole('heading', { name: 'Your everyday, upgraded.' })).toBeVisible();
  await expect(page.locator('article.product-card')).toHaveCount(3);
  await expect(page.getByText('Start strong. Build what matters.')).toHaveCount(0);
  await page.getByLabel('Sort products').selectOption('price-low');
  await expect(page.locator('article.product-card h3').first()).toHaveText('Wireless mouse');
  await page.getByLabel('In stock only').check();
  await expect(page.locator('article.product-card')).toHaveCount(2);
  await page.getByRole('searchbox', { name: 'Search products' }).fill('headphones');
  await page.getByRole('searchbox', { name: 'Search products' }).press('Enter');
  await expect(page.locator('article.product-card')).toHaveCount(1);
  await page.getByRole('button', { name: '+ Add to cart', exact: true }).click();
  await expect(page.getByRole('status')).toContainText('Please sign in');
  await page.getByRole('searchbox', { name: 'Search products' }).fill('missing-item');
  await page.getByRole('searchbox', { name: 'Search products' }).press('Enter');
  await expect(page.getByText('No matching products')).toBeVisible();
  await page.getByRole('button', { name: 'Clear filters' }).click();
  await expect(page.locator('article.product-card')).toHaveCount(3);
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
  await page.screenshot({ path: 'test-results/storefront-desktop.png', fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: 'test-results/storefront-mobile.png', fullPage: true });
  await page.getByRole('link', { name: 'Account', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Sign in to continue' })).toBeVisible();
});

test('storefront UI: failed catalog can be retried', async ({ page }) => {
  let attempts = 0;
  await page.route('**/api/**', async (route) => {
    if (new URL(route.request().url()).pathname === '/api/shop/products') {
      attempts += 1;
      return attempts === 1
        ? route.fulfill({
            status: 503,
            json: { error: { code: 'UNAVAILABLE', message: 'Try again' } }
          })
        : route.fulfill({ json: { data: products } });
    }
    return route.fulfill({ status: 401, json: { error: { code: 'UNAUTHORIZED' } } });
  });
  await page.goto('/');
  await expect(page.locator('main [role=alert]')).toBeVisible();
  await page.getByRole('button', { name: 'Retry loading products' }).click();
  await expect(page.locator('article.product-card')).toHaveCount(3);
  await expect(page.locator('main [role=alert]')).toHaveCount(0);
});

test('account UI: register, add to cart, sign out and login error', async ({ page }) => {
  let signedIn = false;
  let cartCount = 0;
  const user = { id: 123, email: 'ui-fixture@example.test', name: 'UI shopper', role: 'USER' };
  await page.route('**/api/**', async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    if (path === '/api/auth/register') {
      expect(request.postDataJSON()).toEqual({
        email: user.email,
        name: user.name,
        password: 'ui-test-password-2026'
      });
      signedIn = true;
      return route.fulfill({ status: 201, json: { data: user } });
    }
    if (path === '/api/auth/logout') {
      signedIn = false;
      return route.fulfill({ status: 204 });
    }
    if (path === '/api/auth/login')
      return route.fulfill({
        status: 401,
        json: { error: { code: 'INVALID_CREDENTIALS', message: 'Email or password is incorrect.' } }
      });
    if (path === '/api/shop/products') return route.fulfill({ json: { data: products } });
    if (path === '/api/auth/me' && signedIn) return route.fulfill({ json: { data: user } });
    if (path === '/api/shop/cart' && signedIn) {
      if (request.method() === 'POST') cartCount += 1;
      return route.fulfill({
        json: { data: cartCount ? [{ sku: products[0]!.sku, quantity: cartCount }] : [] }
      });
    }
    return route.fulfill({ status: 401, json: { error: { code: 'UNAUTHORIZED' } } });
  });
  await page.goto('/account');
  await page.getByRole('button', { name: 'New here? Create account', exact: true }).click();
  await page.getByLabel('Your name').fill(user.name);
  await page.getByLabel('Email address').fill(user.email);
  await page.getByLabel('Password', { exact: true }).fill('ui-test-password-2026');
  await page.getByRole('button', { name: 'Create account', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Welcome, UI shopper' })).toBeVisible();
  await page.goto('/');
  await page
    .locator('article.product-card')
    .first()
    .getByRole('button', { name: '+ Add to cart', exact: true })
    .click();
  await expect(page.getByRole('status')).toContainText('Mechanical keyboard added to your cart.');
  await expect(
    page
      .getByRole('navigation', { name: 'Shop navigation' })
      .getByRole('link', { name: 'Cart 1', exact: true })
  ).toBeVisible();
  await page.goto('/account');
  await page.getByRole('button', { name: 'Sign out', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Sign in to continue' })).toBeVisible();
  await page.getByLabel('Email address').fill(user.email);
  await page.getByLabel('Password', { exact: true }).fill('wrong-password-2026');
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page.locator('main [role=alert]')).toBeVisible();
});

test('marketplace: category URL survives reload, details enforce stock and missing SKU recovers', async ({
  page
}) => {
  let added = 0;
  await page.route('**/api/**', async (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path === '/api/shop/products') return route.fulfill({ json: { data: products } });
    if (path === '/api/auth/me')
      return route.fulfill({
        json: { data: { id: 123, name: 'UI shopper', email: 'ui@example.test', role: 'USER' } }
      });
    if (path === '/api/shop/cart') {
      if (route.request().method() === 'POST') {
        expect(route.request().postDataJSON()).toEqual({ sku: 'UI-KEYBOARD', quantity: 4 });
        added++;
      }
      return route.fulfill({ json: { data: [] } });
    }
    return route.fulfill({ status: 404, json: { error: { code: 'NOT_FOUND' } } });
  });
  await page.goto('/shop?category=tech&sort=price-low');
  await expect(page.locator('article.product-card')).toHaveCount(3);
  await page.reload();
  await expect(page.locator('article.product-card h3').first()).toHaveText('Wireless mouse');
  await page.getByRole('link', { name: 'Mechanical keyboard', exact: true }).click();
  await expect(
    page.getByRole('heading', { name: 'Mechanical keyboard', exact: true })
  ).toBeVisible();
  await expect(page.getByText('UI-KEYBOARD', { exact: true }).first()).toBeVisible();
  await page.getByLabel('Quantity', { exact: true }).fill('99');
  await expect(page.getByLabel('Quantity', { exact: true })).toHaveValue('4');
  await page.getByRole('button', { name: '+ Add to cart', exact: true }).click();
  await expect(page.getByRole('status')).toContainText('added to your cart');
  expect(added).toBe(1);
  await expect(page.locator('.product-atlas').first()).toBeVisible();
  await expect
    .poll(() =>
      page
        .locator('.product-atlas')
        .first()
        .evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth > 0)
    )
    .toBe(true);
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: 'test-results/marketplace-detail-mobile.png', fullPage: true });
  await page.goto('/shop/product/missing-sku');
  await expect(page.getByRole('heading', { name: 'Product not found' })).toBeVisible();
  await page.getByRole('link', { name: 'Browse all products' }).click();
  await expect(page.locator('article.product-card')).toHaveCount(3);
});
