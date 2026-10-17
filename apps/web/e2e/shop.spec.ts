import { expect, test, type Page } from '@playwright/test';
import type { ApiResponse, OrderView } from '@repo/types';

const adminEmail = process.env.E2E_ADMIN_EMAIL;
const adminPassword = process.env.E2E_ADMIN_PASSWORD;
const fixtureSku = process.env.E2E_SHOP_FIXTURE_SKU;
const controlledPublic = process.env.E2E_SHOP_PUBLIC_ACCEPTANCE === '1';
const suffix = Date.now() + '-' + Math.random().toString(16).slice(2, 8);
const password = process.env.E2E_SHOP_PASSWORD ?? 'isolated-shop-browser-password-7492';

async function request<T>(page: Page, path: string, method = 'GET', body?: object) {
  return page.evaluate(
    async ({ path, method, body }) => {
      const response = await fetch('/api' + path, {
        method,
        headers: { 'Content-Type': 'application/json', 'x-csrf-protection': '1' },
        ...(body ? { body: JSON.stringify(body) } : {})
      });
      return { status: response.status, body: await response.json() };
    },
    { path, method, body }
  ) as Promise<{ status: number; body: T }>;
}

async function register(page: Page, email: string, name: string) {
  await page.goto('/');
  await page.getByLabel('Your name', { exact: true }).fill(name);
  await page.getByLabel('Email address', { exact: true }).fill(email);
  await page.getByLabel('Password', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Create account', exact: true }).last().click();
  await expect(page.getByRole('button', { name: 'Sign out', exact: true })).toBeVisible();
}

test('real shop journey: cart, priced checkout, mock pay, cancellation and user isolation', async ({
  page,
  browser,
  baseURL
}) => {
  const external = process.env.E2E_BASE_URL;
  if (external && !controlledPublic)
    test.skip(true, 'External business writes require controlled acceptance fixtures.');
  if (external && controlledPublic && !fixtureSku?.startsWith('OPS-'))
    throw new Error('Controlled public acceptance requires its own OPS- fixture SKU.');
  if (!fixtureSku)
    test.skip(
      !adminEmail || !adminPassword,
      'An explicit isolated-test administrator is required.'
    );
  const sku = fixtureSku ?? 'E2E-' + suffix;
  const productName = 'Acceptance product ' + sku;
  const aliceEmail = process.env.E2E_SHOP_ALICE_EMAIL ?? 'shop-alice-' + suffix + '@example.test';
  const bobEmail = process.env.E2E_SHOP_BOB_EMAIL ?? 'shop-bob-' + suffix + '@example.test';

  if (!fixtureSku) {
    const admin = await browser.newContext({ baseURL });
    try {
      const account = await admin.newPage();
      await account.goto('/');
      await account.getByRole('button', { name: 'Sign in', exact: true }).first().click();
      await account.getByLabel('Email address', { exact: true }).fill(adminEmail!);
      await account.getByLabel('Password', { exact: true }).fill(adminPassword!);
      await account.getByRole('button', { name: 'Sign in', exact: true }).last().click();
      await expect(account.getByRole('button', { name: 'Sign out', exact: true })).toBeVisible();
      expect(
        (
          await request(account, '/shop/products', 'POST', {
            sku,
            name: productName,
            price: 1234,
            stock: 10
          })
        ).status
      ).toBe(201);
    } finally {
      await admin.close();
    }
  }

  await page.goto('/shop');
  await expect(page.getByRole('heading', { name: productName, exact: true })).toBeVisible();
  expect((await request(page, '/shop/cart')).status).toBe(401);
  await register(page, aliceEmail, 'Alice acceptance');
  const add = async () => {
    await page.goto('/shop');
    await page
      .locator('article.product-card')
      .filter({ hasText: productName })
      .getByRole('button', { name: '+ Add to cart', exact: true })
      .click();
    await expect(page.getByRole('status')).toContainText(productName + ' added to your cart.');
    await page
      .getByRole('navigation', { name: 'Shop navigation' })
      .getByRole('link', { name: /^Cart/ })
      .click();
    await expect(page.getByRole('heading', { name: 'Your cart', exact: true })).toBeVisible();
  };
  await add();
  await page.getByRole('button', { name: 'Remove', exact: true }).click();
  await expect(page.getByText('Your cart is empty', { exact: true })).toBeVisible();
  await add();
  await page.getByRole('button', { name: 'Increase ' + productName, exact: true }).click();
  await expect(page.locator('.stepper span')).toHaveText('2');
  await expect(page.getByRole('complementary', { name: 'Order summary' })).toContainText('¥24.68');
  await page.getByRole('button', { name: 'Place order', exact: false }).click();
  await expect(page.getByRole('heading', { name: 'Your orders', exact: true })).toBeVisible();
  const firstCard = page.locator('article.order-card').first();
  await expect(firstCard.locator('.order-status')).toHaveText('PENDING');
  let orders = await request<ApiResponse<OrderView[]>>(page, '/shop/orders');
  const first = orders.body.data[0]!;
  expect(first.total).toBe(2468);
  await firstCard.getByRole('button', { name: 'Pay now (mock)', exact: true }).click();
  await expect(firstCard.locator('.order-status')).toHaveText('PAID');
  expect(
    (await request(page, '/shop/payments/' + first.orderNo + '/mock-pay', 'POST')).status
  ).toBe(200);

  const other = await browser.newContext({ baseURL });
  try {
    const bob = await other.newPage();
    await register(bob, bobEmail, 'Bob acceptance');
    await bob.goto('/shop/orders');
    await expect(bob.locator('article.order-card')).toHaveCount(0);
    expect((await request(bob, '/shop/orders/' + first.orderNo + '/cancel', 'POST')).status).toBe(
      404
    );
    expect(
      (
        await request(bob, '/shop/products', 'POST', {
          sku: sku + '-DENIED',
          name: 'Denied',
          price: 100,
          stock: 1
        })
      ).status
    ).toBe(403);
  } finally {
    await other.close();
  }

  await add();
  await page.getByRole('button', { name: 'Place order', exact: false }).click();
  await expect(page.locator('article.order-card').first().locator('.order-status')).toHaveText(
    'PENDING'
  );
  page.once('dialog', (dialog) => dialog.accept());
  await page
    .locator('article.order-card')
    .first()
    .getByRole('button', { name: 'Cancel', exact: true })
    .click();
  await expect(page.locator('article.order-card').first().locator('.order-status')).toHaveText(
    'CANCELLED'
  );
  const stock = await request<{ data: { dbStock: number; redisStock: number } }>(
    page,
    '/shop/products/' + sku + '/stock'
  );
  expect(stock.body.data).toMatchObject({ dbStock: 8, redisStock: 8 });
  orders = await request<ApiResponse<OrderView[]>>(page, '/shop/orders');
  expect(orders.body.data).toHaveLength(2);
  expect(
    (await request(page, '/shop/orders', 'POST', { items: [{ sku, quantity: 999 }] })).status
  ).toBe(409);
  expect((await request<ApiResponse<OrderView[]>>(page, '/shop/orders')).body.data).toHaveLength(2);
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.goto('/');
  await page.getByRole('button', { name: 'Sign out', exact: true }).click();
  expect((await request(page, '/shop/orders')).status).toBe(401);
});
