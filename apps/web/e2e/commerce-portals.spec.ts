import { expect, test } from '@playwright/test';
import { randomBytes, scryptSync } from 'node:crypto';
import { PrismaClient } from '../../../packages/db/node_modules/@prisma/client';

test('isolated portals: seller catalog, tenant denial, platform oversight and separate sessions', async ({
  page
}) => {
  test.skip(
    Boolean(process.env.E2E_BASE_URL),
    'Fixture test runs only against the configured isolated CI stack.'
  );
  const db = new PrismaClient();
  const marker = randomBytes(6).toString('hex');
  const password = randomBytes(20).toString('base64url');
  const ids: number[] = [],
    merchants: number[] = [];
  const account = async (label: string) => {
    const salt = randomBytes(16).toString('hex');
    const email = `portal-${label}-${marker}@example.test`;
    const user = await db.user.create({
      data: {
        email,
        name: 'Portal fixture',
        passwordHash: `scrypt$${salt}$${scryptSync(password, salt, 64).toString('hex')}`
      }
    });
    ids.push(user.id);
    return email;
  };
  const login = async (path: string, email: string) => {
    await page.goto(path);
    await page.getByLabel('Email address').fill(email);
    await page.getByLabel('Password', { exact: true }).fill(password);
    await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  };
  try {
    const sellerA = await account('a');
    const a = await db.merchant.create({
      data: {
        name: `Merchant A ${marker}`,
        stores: { create: { name: 'Store A' } },
        members: { create: { userId: ids[0]!, role: 'OWNER' } }
      }
    });
    merchants.push(a.id);
    const sellerB = await account('b');
    const b = await db.merchant.create({
      data: {
        name: `Merchant B ${marker}`,
        stores: { create: { name: 'Store B' } },
        members: { create: { userId: ids[1]!, role: 'OWNER' } }
      }
    });
    merchants.push(b.id);
    const admin = await account('admin');
    await db.platformMembership.create({ data: { userId: ids[2]!, role: 'VIEWER' } });
    const sku = `PORTAL-${marker}`;
    await login('/seller', sellerA);
    await expect(page.getByRole('heading', { name: 'Your shop', exact: true })).toBeVisible();
    await page.getByLabel('SKU', { exact: true }).fill(sku);
    await page.getByLabel('Name', { exact: true }).fill('Portal acceptance product');
    await page.getByLabel('Description', { exact: true }).fill('Isolated browser fixture');
    await page.getByLabel('Price (CNY)').fill('12.34');
    await page.getByLabel('Initial stock').fill('4');
    await page.getByRole('button', { name: 'Create product', exact: true }).click();
    await expect(page.getByRole('row').filter({ hasText: sku })).toContainText('¥12.34');
    await page.reload();
    const row = page.getByRole('row').filter({ hasText: sku });
    await row.getByLabel(`Stock quantity for ${sku}`).fill('2');
    await row.getByRole('button', { name: 'Add stock', exact: true }).click();
    await expect(row).toContainText('6');
    expect(await page.evaluate(async () => (await fetch('/api/admin/merchants')).status)).toBe(401);
    expect(await page.evaluate(async () => (await fetch('/api/auth/me')).status)).toBe(401);
    await page.getByRole('button', { name: 'Sign out', exact: true }).click();
    await login('/seller', sellerB);
    await expect(page.getByText('No products yet. Create your first product above.')).toBeVisible();
    expect(
      await page.evaluate(
        async (sku) =>
          (
            await fetch('/api/shop/merchant/products/' + sku, {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json', 'X-CSRF-Protection': '1' },
              body: JSON.stringify({ name: 'Unauthorized' })
            })
          ).status,
        sku
      )
    ).toBe(404);
    await login('/admin', admin);
    await expect(page.getByRole('heading', { name: 'Merchants', exact: true })).toBeVisible();
    await expect(page.getByRole('row').filter({ hasText: `Merchant A ${marker}` })).toBeVisible();
    await page.getByRole('button', { name: 'Products', exact: true }).click();
    await expect(page.getByRole('row').filter({ hasText: sku })).toContainText(
      `Merchant A ${marker}`
    );
    await page.getByRole('button', { name: 'Audit trail', exact: true }).click();
    await expect(
      page.getByRole('row').filter({ hasText: 'PRODUCT_CREATED' }).filter({ hasText: sku })
    ).toBeVisible();
    await page.screenshot({ path: 'test-results/portal-admin.png', fullPage: true });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/seller');
    await expect(page.getByRole('heading', { name: 'Your shop', exact: true })).toBeVisible();
    await expect(page.getByText(sellerB, { exact: false })).toBeVisible();
    await page.screenshot({ path: 'test-results/portal-seller-mobile.png', fullPage: true });
    await page.getByRole('button', { name: 'Sign out', exact: true }).click();
    await page.goto('/admin');
    await expect(page.getByText(admin, { exact: true })).toBeVisible();
  } finally {
    await db.commerceAudit.deleteMany({ where: { merchantId: { in: merchants } } });
    await db.product.deleteMany({ where: { merchantId: { in: merchants } } });
    await db.merchantMembership.deleteMany({ where: { merchantId: { in: merchants } } });
    await db.store.deleteMany({ where: { merchantId: { in: merchants } } });
    await db.merchant.deleteMany({ where: { id: { in: merchants } } });
    await db.platformMembership.deleteMany({ where: { userId: { in: ids } } });
    await db.user.deleteMany({ where: { id: { in: ids } } });
    await db.$disconnect();
  }
});
