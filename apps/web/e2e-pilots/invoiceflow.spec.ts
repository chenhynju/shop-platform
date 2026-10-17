import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
test('InvoiceFlow consumes shared locale core while preserving invoice and organization workflow', async ({
  page,
  request
}) => {
  const run = Date.now() + '-' + Math.random().toString(16).slice(2, 8);
  const output = path.resolve(process.cwd(), '../../.local/evidence-i18n');
  fs.mkdirSync(output, { recursive: true });
  expect((await request.get('/api/v1/documents')).status()).toBe(401);
  await page.goto('/login');
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  await expect(
    page.getByRole('heading', { name: 'Sign in to your workspace', exact: true })
  ).toBeVisible();
  await page.getByRole('button', { name: 'New here? Create an account', exact: true }).click();
  await page.getByLabel('Name', { exact: true }).fill('Toolkit pilot');
  await page.getByLabel('Email', { exact: true }).fill('toolkit-pilot-' + run + '@example.test');
  await page.getByLabel('Password', { exact: true }).fill('pilot-disposable-password-629174');
  await page.getByRole('button', { name: 'Create account', exact: true }).click();
  await expect(
    page.getByRole('heading', { name: 'Create your first organization', exact: true })
  ).toBeVisible();
  const who = await (await page.request.get('/api/v1/saas/me')).json();
  await page
    .getByLabel('Create another organization', { exact: true })
    .fill('Pilot Finance A ' + run);
  await page.getByRole('button', { name: 'Create organization', exact: true }).click();
  await expect(
    page.getByRole('heading', { name: 'Organization workspace', exact: true })
  ).toBeVisible();
  const orgA = await page
    .getByRole('combobox', { name: 'Current organization', exact: true })
    .inputValue();
  await page.getByRole('combobox', { name: 'Language', exact: true }).selectOption('zh-CN');
  await expect(page.getByRole('heading', { name: '组织工作台', exact: true })).toBeVisible();
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('lang', 'zh-CN');
  await expect(page.getByRole('combobox', { name: '当前组织', exact: true })).toHaveValue(orgA);
  expect((await (await page.request.get('/api/v1/saas/me')).json()).user.id).toBe(who.user.id);
  await page.getByRole('link', { name: '上传票据', exact: true }).first().click();
  const pilotRoot =
    process.env.INVOICEFLOW_PILOT_DIR ??
    path.resolve(process.cwd(), '../../.local/pilots/invoiceflow');
  const xml = Buffer.concat([
    fs.readFileSync(path.join(pilotRoot, 'apps/eval/golden-set/invoice-ubl-01.xml')),
    Buffer.from('<!-- toolkit-' + run + ' -->')
  ]);
  await page
    .locator('input[type=file]')
    .setInputFiles({ name: 'pilot-i18n.xml', mimeType: 'application/xml', buffer: xml });
  await page.getByRole('button', { name: /开始上传|Start upload/ }).click();
  await expect(page).toHaveURL(/\/documents$/);
  const headersA = { 'x-organization-id': orgA };
  await expect
    .poll(
      async () =>
        (await (await page.request.get('/api/v1/documents', { headers: headersA })).json()).total
    )
    .toBe(1);
  const list = await (await page.request.get('/api/v1/documents', { headers: headersA })).json();
  const legacyId = list.data[0].id as string;
  await expect
    .poll(
      async () =>
        (
          await (
            await page.request.get('/api/v1/documents/' + legacyId, { headers: headersA })
          ).json()
        ).status
    )
    .toBe('needs_review');
  const legacy = await (
    await page.request.get('/api/v1/documents/' + legacyId, { headers: headersA })
  ).json();
  expect(
    legacy.fields.find((field: { fieldName: string }) => field.fieldName === 'invoice_number')
      .fieldValue
  ).toBe('UBL-2026-001');
  expect(legacy.fields.some((field: { fieldName: string }) => field.fieldName === 'total')).toBe(
    false
  );
  expect(
    legacy.validationResults.find(
      (check: { checkName: string }) => check.checkName === 'required_fields'
    ).passed
  ).toBe(false);
  // Keep the legacy negative fixture intact. A separate positive fixture has an independent money oracle.
  await page.goto('/upload');
  const positive = Buffer.concat([
    fs.readFileSync(
      path.resolve(process.cwd(), '../../examples/invoiceflow/fixtures/invoice-pilot-ubl.xml')
    ),
    Buffer.from('<!-- ' + run + ' -->')
  ]);
  await page
    .locator('input[type=file]')
    .setInputFiles({ name: 'pilot-amounts.xml', mimeType: 'application/xml', buffer: positive });
  await page.getByRole('button', { name: /开始上传|Start upload/ }).click();
  await expect(page).toHaveURL(/\/documents$/);
  const positiveList = await (
    await page.request.get('/api/v1/documents', { headers: headersA })
  ).json();
  expect(positiveList.total).toBe(2);
  const id = positiveList.data.find(
    (item: { filename: string }) => item.filename === 'pilot-amounts.xml'
  ).id as string;
  await expect
    .poll(
      async () =>
        (await (await page.request.get('/api/v1/documents/' + id, { headers: headersA })).json())
          .status
    )
    .toBe('needs_review');
  const detail = await (
    await page.request.get('/api/v1/documents/' + id, { headers: headersA })
  ).json();
  const fields = Object.fromEntries(
    detail.fields.map((field: { fieldName: string; fieldValue: string }) => [
      field.fieldName,
      field.fieldValue
    ])
  );
  expect(fields).toMatchObject({
    invoice_number: 'TOOLKIT-PILOT-001',
    vendor_name: 'Toolkit Supplier',
    currency: 'EUR',
    subtotal: '2000.00',
    tax: '380.00',
    total: '2380.00'
  });
  expect(
    detail.lineItems.reduce((sum: number, line: { total: number }) => sum + line.total, 0)
  ).toBe(2000);
  for (const name of ['required_fields', 'amount_sum', 'tax_calc'])
    expect(
      detail.validationResults.find((check: { checkName: string }) => check.checkName === name)
        .passed
    ).toBe(true);
  await page.goto('/documents/' + id);
  await expect(page.getByRole('heading', { name: 'pilot-amounts.xml', exact: true })).toBeVisible();
  await expect(page.getByRole('textbox', { name: '价税合计', exact: true })).toHaveValue('2380.00');
  await expect(page.getByRole('textbox', { name: '金额（不含税）', exact: true })).toHaveValue(
    '2000.00'
  );
  await expect(page.getByRole('textbox', { name: '税额', exact: true })).toHaveValue('380.00');
  await page.screenshot({ path: path.join(output, 'invoiceflow-amounts.png'), fullPage: true });
  await page.getByRole('combobox', { name: '语言', exact: true }).selectOption('en');
  await page.getByRole('link', { name: 'Organization workspace', exact: true }).click();
  await page
    .getByLabel('Create another organization', { exact: true })
    .fill('Pilot Finance B ' + run);
  await page.getByRole('button', { name: 'Create organization', exact: true }).click();
  await expect(
    page.getByRole('combobox', { name: 'Current organization', exact: true })
  ).not.toHaveValue(orgA);
  const orgB = await page
    .getByRole('combobox', { name: 'Current organization', exact: true })
    .inputValue();
  expect(
    (
      await (
        await page.request.get('/api/v1/documents', { headers: { 'x-organization-id': orgB } })
      ).json()
    ).total
  ).toBe(0);
  expect(
    (
      await page.request.get('/api/v1/documents/' + id, { headers: { 'x-organization-id': orgB } })
    ).status()
  ).toBe(404);
  await page
    .getByRole('combobox', { name: 'Current organization', exact: true })
    .selectOption(orgA);
  await expect(
    page.getByRole('heading', { name: 'Organization workspace', exact: true })
  ).toBeVisible();
  const restored = await (
    await page.request.get('/api/v1/documents', { headers: headersA })
  ).json();
  expect(restored.total).toBe(2);
  expect(restored.data.some((item: { id: string }) => item.id === id)).toBe(true);
  await page.screenshot({ path: path.join(output, 'invoiceflow-desktop.png'), fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: path.join(output, 'invoiceflow-mobile.png'), fullPage: true });
  await page.getByRole('button', { name: 'Sign out', exact: true }).click();
  await expect(
    page.getByRole('heading', { name: 'Sign in to your workspace', exact: true })
  ).toBeVisible();
  expect((await page.request.get('/api/v1/saas/me')).status()).toBe(401);
});
