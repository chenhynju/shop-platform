import { expect, test } from '@playwright/test';
test('English is the server default, preference survives refresh and manual navigation', async ({
  browser,
  baseURL
}) => {
  const context = await browser.newContext({ baseURL, locale: 'zh-CN' });
  try {
    const page = await context.newPage();
    page.setDefaultTimeout(15000);
    page.setDefaultNavigationTimeout(30000);
    const initial = await page.goto('/workspace');
    expect(await initial!.text()).toContain('lang="en"');
    await expect(
      page.getByRole('heading', { name: 'Start strong. Build what matters.' })
    ).toBeVisible();
    await page.getByRole('combobox', { name: 'Language', exact: true }).selectOption('zh-CN');
    await expect(page.locator('html')).toHaveAttribute('lang', 'zh-CN');
    await expect(page.getByRole('heading', { name: '从稳固起点，构建重要的事。' })).toBeVisible();
    const refreshed = await page.reload();
    expect(await refreshed!.text()).toContain('lang="zh-CN"');
    await page.getByRole('link', { name: '用户操作手册', exact: true }).click();
    await expect(
      page.getByRole('heading', { name: '用户操作与项目接入手册', exact: true })
    ).toBeVisible();
    await expect(page.locator('.manual-section')).toHaveCount(7);
    await page.getByRole('combobox', { name: '语言', exact: true }).selectOption('en');
    await expect(
      page.getByRole('heading', { name: 'User and project adoption manual', exact: true })
    ).toBeVisible();
    await page.setViewportSize({ width: 390, height: 844 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true
    );
    await context.addCookies([{ name: 'toolkit_locale', value: 'unsupported', url: baseURL! }]);
    await page.reload();
    await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  } finally {
    await context.close();
  }
});
test('Chinese CRUD, plain user content, localized errors and unchanged session on language switch', async ({
  page
}) => {
  const id = Date.now() + '-' + Math.random().toString(16).slice(2, 8);
  await page.goto('/workspace');
  await page.getByRole('combobox', { name: 'Language', exact: true }).selectOption('zh-CN');
  await page.getByLabel('姓名', { exact: true }).fill('中文验收');
  const email = 'i18n-' + id + '@example.com';
  await page.getByLabel('邮箱地址').fill(email);
  await page.getByLabel('密码', { exact: true }).fill('i18n-acceptance-password-2026');
  await page.getByRole('button', { name: '创建账号', exact: true }).last().click();
  await page.getByRole('button', { name: '+ 新建项目', exact: true }).click();
  const dialog = page.getByRole('dialog');
  const title = 'InvoiceFlow <demo> ' + id;
  await dialog.getByLabel('项目名称').fill(title);
  await dialog.getByLabel('描述', { exact: true }).fill('保持用户原文，不自动翻译');
  await dialog.getByLabel('状态', { exact: true }).selectOption('ACTIVE');
  await dialog.getByRole('button', { name: '创建项目', exact: true }).click();
  await expect(
    page
      .getByRole('region', { name: '进行中', exact: true })
      .getByRole('heading', { name: title, exact: true })
  ).toBeVisible();
  const before = (await (await page.request.get('/api/auth/me')).json()).data;
  await page.getByRole('combobox', { name: '语言', exact: true }).selectOption('en');
  await expect(page.getByRole('heading', { name: title, exact: true })).toBeVisible();
  expect((await (await page.request.get('/api/auth/me')).json()).data.id).toBe(before.id);
  await page.getByRole('button', { name: 'Edit ' + title, exact: true }).click();
  await page.getByRole('dialog').getByLabel('Status', { exact: true }).selectOption('DONE');
  await page.getByRole('button', { name: 'Save changes', exact: true }).click();
  await expect(
    page
      .getByRole('region', { name: 'Completed', exact: true })
      .getByRole('heading', { name: title, exact: true })
  ).toBeVisible();
  page.once('dialog', (confirmation) => confirmation.accept());
  await page.getByRole('button', { name: 'Delete ' + title, exact: true }).click();
  await expect(page.getByRole('heading', { name: title, exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: 'Sign out', exact: true }).click();
  await expect(
    page.getByRole('heading', { name: 'Start strong. Build what matters.' })
  ).toBeVisible();
  await page.getByRole('combobox', { name: 'Language', exact: true }).selectOption('zh-CN');
  await page.getByRole('button', { name: '登录', exact: true }).first().click();
  await page.getByLabel('邮箱地址').fill(email);
  await page.getByLabel('密码', { exact: true }).fill('incorrect-password-2971');
  await page.getByRole('button', { name: '登录', exact: true }).last().click();
  await expect(page.getByRole('alert').filter({ hasText: '邮箱或密码不正确。' })).toBeVisible();
});
