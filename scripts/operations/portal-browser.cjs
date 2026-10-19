const { chromium, request, expect } = require('../../apps/web/node_modules/@playwright/test');
const { randomBytes } = require('node:crypto');
const fs = require('node:fs');
const matrix = JSON.parse(process.env.PORTAL_MATRIX);
const stage = process.env.PORTAL_PREVIEW === '1';
const headers = stage ? { 'X-Shop-Portal-Preview': 'portals-r20261019' } : {};
const baseURL = 'https://shop.purelamp.uk';
const mutation = { 'X-CSRF-Protection': '1', Origin: baseURL };
const evidence = stage ? '.local/portal-evidence/stage' : '.local/portal-evidence/public';
fs.mkdirSync(evidence, { recursive: true });
async function json(response, status = 200) {
  expect(response.status()).toBe(status);
  return (await response.json()).data;
}
async function apiLogin(record) {
  const context = await request.newContext({ baseURL, extraHTTPHeaders: headers });
  await json(
    await context.post(`/api/${record.audience}/auth/login`, {
      headers: mutation,
      maxRetries: 2,
      data: { email: record.email, password: record.password }
    })
  );
  const me = await json(await context.get(`/api/${record.audience}/auth/me`));
  expect(me.email).toBe(record.email);
  return context;
}
(async () => {
  const browser = await chromium.launch({ headless: true });
  let buyer;
  const contexts = [];
  try {
    for (const record of matrix) {
      const c = await apiLogin(record);
      if (record.audience === 'seller') {
        const data = await json(await c.get('/api/seller/context'));
        expect(data.merchant.id).toBe(record.merchantId);
        expect(data.role).toBe('OWNER');
        expect(data.merchant.stores.length).toBeGreaterThan(0);
        await json(await c.get('/api/shop/merchant/products'));
        await json(await c.get('/api/shop/merchant/orders'));
        expect((await c.get('/api/admin/merchants')).status()).toBe(401);
      } else {
        const merchants = await json(await c.get('/api/admin/merchants'));
        expect(merchants.length).toBe(8);
        for (const resource of ['products', 'orders', 'audit'])
          await json(await c.get('/api/admin/' + resource));
        expect((await c.get('/api/seller/context')).status()).toBe(401);
      }
      await c.dispose();
    }
    console.log('MATRIX_LOGIN_AND_SCOPE_PASS 9/9');
    const context = await browser.newContext({
      baseURL,
      extraHTTPHeaders: headers,
      viewport: { width: 1280, height: 800 }
    });
    contexts.push(context);
    const page = await context.newPage();
    async function login(path, record) {
      await page.goto(path);
      await page.getByLabel('Email address').fill(record.email);
      await page.getByLabel('Password', { exact: true }).fill(record.password);
      const loginPath = path === '/account' ? '/api/auth/login' : `/api${path}/auth/login`;
      const [response] = await Promise.all([
        page.waitForResponse(
          (r) => new URL(r.url()).pathname === loginPath && r.request().method() === 'POST'
        ),
        page.getByRole('button', { name: 'Sign in', exact: true }).click()
      ]);
      expect(response.status()).toBe(200);
      await response.finished();
      if (path === '/account')
        await expect(
          page.getByRole('heading', { name: 'Welcome, Portal stage acceptance' })
        ).toBeVisible();
    }
    await login('/seller', matrix[0]);
    await expect(page.getByRole('heading', { name: 'Your shop', exact: true })).toBeVisible();
    await page.reload();
    await expect(page.getByRole('heading', { name: 'Your shop', exact: true })).toBeVisible();
    let orderNo, skuA, skuB;
    if (stage) {
      const marker = randomBytes(5).toString('hex');
      skuA = 'PS-A-' + marker;
      skuB = 'PS-B-' + marker;
      await page.getByLabel('SKU', { exact: true }).fill(skuA);
      await page.getByLabel('Name', { exact: true }).fill('Portal stage product A');
      await page.getByLabel('Description', { exact: true }).fill('Isolated pre-release acceptance');
      await page.getByLabel('Price (CNY)').fill('12.34');
      await page.getByLabel('Initial stock').fill('4');
      await page.getByRole('button', { name: 'Create product', exact: true }).click();
      const row = page.getByRole('row').filter({ hasText: skuA });
      await expect(row).toContainText('¥12.34');
      await row.getByLabel(`Stock quantity for ${skuA}`).fill('2');
      await row.getByRole('button', { name: 'Add stock', exact: true }).click();
      await expect(row).toContainText('6');
      await row.getByRole('button', { name: 'Edit', exact: true }).click();
      await page.getByLabel('Price (CNY)').fill('15.67');
      await page.locator('select[name=status]').selectOption('OFFLINE');
      await page.getByRole('button', { name: 'Save product', exact: true }).click();
      await expect(row).toContainText('OFFLINE');
      await row.getByRole('button', { name: 'Edit', exact: true }).click();
      await page.locator('select[name=status]').selectOption('ACTIVE');
      await page.getByRole('button', { name: 'Save product', exact: true }).click();
      await expect(row).toContainText('ACTIVE');
      const b = await apiLogin(matrix[1]);
      expect(
        (
          await b.patch('/api/shop/merchant/products/' + skuA, {
            headers: mutation,
            data: { name: 'Stolen' }
          })
        ).status()
      ).toBe(404);
      await json(
        await b.post('/api/shop/merchant/products', {
          headers: mutation,
          data: { sku: skuB, name: 'Portal stage product B', price: 1000, stock: 3 }
        }),
        201
      );
      await b.dispose();
      buyer = {
        email: `portal-stage-buyer-${marker}@example.test`,
        password: randomBytes(20).toString('base64url')
      };
      const customer = await request.newContext({ baseURL, extraHTTPHeaders: headers });
      await json(
        await customer.post('/api/auth/register', {
          headers: mutation,
          data: { ...buyer, name: 'Portal stage acceptance' }
        }),
        201
      );
      const order = await json(
        await customer.post('/api/shop/orders', {
          headers: mutation,
          data: {
            items: [
              { sku: skuA, quantity: 1 },
              { sku: skuB, quantity: 1 }
            ]
          }
        }),
        201
      );
      orderNo = order.orderNo;
      await json(
        await customer.post(`/api/shop/payments/${orderNo}/mock-pay`, { headers: mutation })
      );
      await page.reload();
      const article = page.locator('article.order-card').filter({ hasText: orderNo });
      await expect(article).toContainText(skuA);
      await expect(article).not.toContainText(skuB);
      await article.getByRole('button', { name: 'Mark your items fulfilled', exact: true }).click();
      await expect(article).toContainText('FULFILLED');
      await page.getByRole('button', { name: 'Sign out', exact: true }).click();
      await login('/seller', matrix[1]);
      const bOrder = page.locator('article.order-card').filter({ hasText: orderNo });
      await expect(bOrder).toContainText(skuB);
      await expect(bOrder).not.toContainText(skuA);
      await bOrder.getByRole('button', { name: 'Mark your items fulfilled', exact: true }).click();
      await expect(bOrder).toContainText('FULFILLED');
      const orders = await json(await customer.get('/api/shop/orders'));
      expect(orders.find((o) => o.orderNo === orderNo).status).toBe('FULFILLED');
      await customer.dispose();
      console.log('STAGE_CATALOG_ORDER_ISOLATION_FULFILLMENT_PASS');
    }
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.screenshot({ path: `${evidence}/seller-desktop.png`, fullPage: true });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.screenshot({ path: `${evidence}/seller-mobile.png`, fullPage: true });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true
    );
    await page.setViewportSize({ width: 1280, height: 800 });
    await login('/admin', matrix[8]);
    await expect(page.getByRole('heading', { name: 'Merchants', exact: true })).toBeVisible();
    await expect(page.getByRole('row').filter({ hasText: matrix[0].email })).toBeVisible();
    for (const tab of ['Products', 'Orders', 'Audit trail']) {
      await page.getByRole('button', { name: tab, exact: true }).click();
      await expect(page.getByRole('heading', { name: tab, exact: true })).toBeVisible();
      if (stage && tab === 'Orders')
        await expect(page.getByRole('row').filter({ hasText: orderNo })).toContainText('FULFILLED');
    }
    await page.screenshot({ path: `${evidence}/admin-desktop.png`, fullPage: true });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.screenshot({ path: `${evidence}/admin-mobile.png`, fullPage: true });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true
    );
    await page.goto('/seller');
    await expect(page.getByRole('heading', { name: 'Your shop', exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Sign out', exact: true }).click();
    await page.goto('/admin');
    await expect(page.getByText(matrix[8].email, { exact: true })).toBeVisible();
    if (stage) {
      await login('/account', buyer);
      await page.goto('/shop/orders');
      await expect(page.getByText(orderNo, { exact: true })).toBeVisible();
      await page.screenshot({ path: `${evidence}/buyer-orders.png`, fullPage: true });
    }
    console.log('THREE_PORTAL_BROWSER_PASS');
  } finally {
    await Promise.all(contexts.map((c) => c.close()));
    await browser.close();
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
