import { expect, test, type Page } from '@playwright/test';
const password = 'browser-test-password-2971';
const suffix = process.env.E2E_RUN_ID ?? Date.now() + '-' + Math.random().toString(16).slice(2, 8);
async function register(page: Page, email: string, name: string) {
  await page.goto('/workspace');
  await page.getByLabel('Your name', { exact: true }).fill(name);
  await page.getByLabel('Email address').fill(email);
  await page.getByLabel('Password', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Create account', exact: true }).last().click();
  await expect(page.getByRole('button', { name: '+ New project' })).toBeVisible();
}
test('anonymous landing, API protection and mobile layout', async ({ page, request, baseURL }) => {
  await page.goto('/workspace');
  await expect(
    page.getByRole('heading', { name: 'Start strong. Build what matters.' })
  ).toBeVisible();
  await expect(page.getByTestId('api-status')).toHaveText('API connected');
  expect((await request.get('/api/projects')).status()).toBe(401);
  const csrf = await request.post('/api/auth/logout', { data: {}, headers: { origin: baseURL! } });
  expect(csrf.status()).toBe(403);
  await page.getByText('Read the guide +').click();
  await expect(page.getByRole('heading', { name: 'Try the full workflow' })).toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true
  );
});
test('two real accounts: CRUD, session persistence, role and owner isolation, logout and login', async ({
  page,
  browser,
  baseURL
}) => {
  const email = 'e2e-alice-' + suffix + '@example.com';
  await register(page, email, 'Alice browser');
  await page.getByRole('button', { name: '+ New project' }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('Project title').fill('Browser acceptance ' + suffix);
  await dialog.getByLabel('Description').fill('Created through the real browser.');
  await dialog.getByRole('button', { name: 'Create project', exact: true }).click();
  const title = 'Browser acceptance ' + suffix;
  await expect(page.getByRole('heading', { name: title, exact: true })).toBeVisible();
  const projects = await (await page.request.get('/api/projects')).json();
  const projectId = projects.data.find((item: { title: string }) => item.title === title)
    .id as string;
  await page.reload();
  await expect(page.getByRole('heading', { name: title, exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Edit ' + title, exact: true }).click();
  await dialog.getByLabel('Project title').fill('Updated ' + suffix);
  await dialog.getByLabel('Status', { exact: true }).selectOption('ACTIVE');
  await dialog.getByRole('button', { name: 'Save changes' }).click();
  await expect(
    page
      .getByRole('region', { name: 'In progress', exact: true })
      .getByRole('heading', { name: 'Updated ' + suffix })
  ).toBeVisible();
  expect((await page.request.get('/api/users')).status()).toBe(403);
  const contextB = await browser.newContext({ baseURL });
  try {
    const bob = await contextB.newPage();
    await register(bob, 'e2e-bob-' + suffix + '@example.com', 'Bob browser');
    await expect(bob.getByRole('heading', { name: 'Updated ' + suffix })).toHaveCount(0);
    for (const method of ['GET', 'PATCH', 'DELETE']) {
      const response = await bob.request.fetch('/api/projects/' + projectId, {
        method,
        headers: { 'X-CSRF-Protection': '1', Origin: baseURL! },
        ...(method === 'PATCH' ? { data: { title: 'Stolen' } } : {})
      });
      expect(response.status()).toBe(404);
    }
    const forged = await bob.request.post('/api/projects', {
      headers: { 'X-CSRF-Protection': '1', Origin: baseURL! },
      data: { title: 'Forged owner', ownerId: 1 }
    });
    expect(forged.status()).toBe(400);
    await bob.getByRole('button', { name: 'Sign out', exact: true }).click();
    await expect(
      bob.getByRole('heading', { name: 'Start strong. Build what matters.' })
    ).toBeVisible();
    expect((await bob.request.get('/api/auth/me')).status()).toBe(401);
  } finally {
    await contextB.close();
  }
  page.once('dialog', (dialog) => dialog.accept());
  await page.getByRole('button', { name: 'Delete Updated ' + suffix, exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Updated ' + suffix })).toHaveCount(0);
  await page.getByRole('button', { name: 'Sign out', exact: true }).click();
  await expect(
    page.getByRole('heading', { name: 'Start strong. Build what matters.' })
  ).toBeVisible();
  await expect(
    page.getByRole('heading', { name: 'Start strong. Build what matters.' })
  ).toBeVisible();
  expect((await page.request.get('/api/auth/me')).status()).toBe(401);
  await page.getByRole('button', { name: 'Sign in', exact: true }).first().click();
  await page.getByLabel('Email address').fill(email);
  await page.getByLabel('Password', { exact: true }).fill('incorrect-password-1234');
  await page.getByRole('button', { name: 'Sign in', exact: true }).last().click();
  await expect(
    page.getByRole('alert').filter({ hasText: 'Email or password is incorrect.' })
  ).toBeVisible();
  await page.getByLabel('Password', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Sign in', exact: true }).last().click();
  await expect(page.getByRole('button', { name: '+ New project' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Members', exact: true })).toHaveCount(0);
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true
  );
  await page.getByRole('button', { name: 'Sign out', exact: true }).click();
  await expect(
    page.getByRole('heading', { name: 'Start strong. Build what matters.' })
  ).toBeVisible();
});
test('explicitly provisioned administrator can inspect the member directory', async ({ page }) => {
  test.skip(
    !process.env.E2E_ADMIN_EMAIL || !process.env.E2E_ADMIN_PASSWORD,
    'No explicit operator test credentials supplied.'
  );
  await page.goto('/workspace');
  await page.getByRole('button', { name: 'Sign in', exact: true }).first().click();
  await page.getByLabel('Email address').fill(process.env.E2E_ADMIN_EMAIL!);
  await page.getByLabel('Password', { exact: true }).fill(process.env.E2E_ADMIN_PASSWORD!);
  await page.getByRole('button', { name: 'Sign in', exact: true }).last().click();
  await page.getByRole('button', { name: 'Members', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Member directory' })).toBeVisible();
  await expect(page.getByText(process.env.E2E_ADMIN_EMAIL!, { exact: true })).toBeVisible();
  await page.getByRole('combobox', { name: 'Language', exact: true }).selectOption('zh-CN');
  await expect(page.getByRole('heading', { name: '成员目录', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: '成员', exact: true })).toBeVisible();
  expect((await (await page.request.get('/api/auth/me')).json()).data.role).toBe('ADMIN');
  await page.getByRole('combobox', { name: '语言', exact: true }).selectOption('en');
  await page.getByRole('button', { name: 'Sign out', exact: true }).click();
  await expect(
    page.getByRole('heading', { name: 'Start strong. Build what matters.' })
  ).toBeVisible();
});
