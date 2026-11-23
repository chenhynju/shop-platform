import { expect, test } from '@playwright/test';
test.use({
  extraHTTPHeaders:
    process.env.E2E_STOREFRONT_PREVIEW === '1' ? { 'X-Shop-Preview': 'storefront-r20261018' } : {}
});
const product = {
  id: 1,
  sku: 'KB-87',
  name: 'Mechanical Keyboard',
  description: 'Hot-swappable, gasket mount, 87 keys',
  price: 12900,
  stock: 10,
  status: 'ACTIVE'
};
const cases = [
  {
    locale: 'zh-CN',
    language: '语言',
    hero: '让你的日常， 更好一点。',
    name: '机械键盘',
    qty: '数量',
    add: '+ 加入购物车',
    cart: '你的购物车',
    orders: '你的订单',
    pay: '模拟支付',
    paid: '已支付',
    search: '搜索商品',
    account: '账号',
    email: '邮箱地址',
    password: '密码',
    signIn: '登录',
    invalid: '邮箱或密码不正确。'
  },
  {
    locale: 'fr',
    language: 'Langue',
    hero: 'Votre quotidien, amélioré.',
    name: 'Clavier mécanique',
    qty: 'Quantité',
    add: '+ Ajouter au panier',
    cart: 'Votre panier',
    orders: 'Vos commandes',
    pay: 'Payer (simulation)',
    paid: 'Payée',
    search: 'Rechercher des produits',
    account: 'Compte',
    email: 'Adresse e-mail',
    password: 'Mot de passe',
    signIn: 'Se connecter',
    invalid: 'L’adresse e-mail ou le mot de passe est incorrect.'
  },
  {
    locale: 'es',
    language: 'Idioma',
    hero: 'Tu día a día, mejorado.',
    name: 'Teclado mecánico',
    qty: 'Cantidad',
    add: '+ Añadir al carrito',
    cart: 'Tu carrito',
    orders: 'Tus pedidos',
    pay: 'Pagar (simulado)',
    paid: 'Pagado',
    search: 'Buscar productos',
    account: 'Cuenta',
    email: 'Correo electrónico',
    password: 'Contraseña',
    signIn: 'Iniciar sesión',
    invalid: 'El correo electrónico o la contraseña son incorrectos.'
  }
] as const;
for (const c of cases)
  test(`commerce ${c.locale}: SSR, preference, localized catalog and private purchase flows`, async ({
    page,
    context
  }) => {
    let cartQuantity = 0,
      paid = false,
      signedIn = true;
    const user = {
      id: 123,
      name: 'Untranslated Buyer <demo>',
      email: 'locale-fixture@example.test',
      role: 'USER'
    };
    await page.route('**/api/**', async (route) => {
      const request = route.request(),
        path = new URL(request.url()).pathname;
      if (path === '/api/shop/products') return route.fulfill({ json: { data: [product] } });
      if (path === '/api/auth/me' && signedIn) return route.fulfill({ json: { data: user } });
      if (path === '/api/auth/logout') {
        signedIn = false;
        return route.fulfill({ status: 204 });
      }
      if (path === '/api/auth/login')
        return route.fulfill({
          status: 401,
          json: {
            error: { code: 'INVALID_CREDENTIALS', message: 'Email or password is incorrect.' }
          }
        });
      if (path === '/api/shop/cart' && signedIn) {
        if (request.method() === 'POST') {
          expect(request.postDataJSON()).toEqual({ sku: 'KB-87', quantity: 2 });
          cartQuantity += 2;
        }
        return route.fulfill({
          json: { data: cartQuantity ? [{ sku: product.sku, quantity: cartQuantity }] : [] }
        });
      }
      if (path === '/api/shop/promotions') return route.fulfill({ json: { data: [] } });
      if (path === '/api/shop/orders' && signedIn)
        return route.fulfill({
          json: {
            data: [
              {
                id: 1,
                orderNo: 'LOCALE-ORDER-1',
                status: paid ? 'PAID' : 'PENDING',
                total: 25800,
                createdAt: '2026-10-18T00:00:00Z',
                items: [{ sku: product.sku, name: product.name, price: 12900, quantity: 2 }]
              }
            ]
          }
        });
      if (path === '/api/shop/payments/LOCALE-ORDER-1/mock-pay') {
        paid = true;
        return route.fulfill({ json: { data: {} } });
      }
      return route.fulfill({ status: 401, json: { error: { code: 'UNAUTHORIZED' } } });
    });
    await page.goto('/');
    await page.getByRole('combobox', { name: 'Language', exact: true }).selectOption(c.locale);
    await expect(page.locator('html')).toHaveAttribute('lang', c.locale);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(c.hero);
    await expect(page.getByRole('link', { name: c.name, exact: true })).toBeVisible();
    expect((await context.cookies()).find((x) => x.name === 'toolkit_locale')?.value).toBe(
      c.locale
    );
    const reload = await page.reload();
    expect(await reload!.text()).toContain('lang="' + c.locale + '"');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(c.hero);
    await page.getByRole('searchbox', { name: c.search }).fill('KB-87');
    await page.getByRole('searchbox', { name: c.search }).press('Enter');
    await expect(page).toHaveURL(/q=KB-87/);
    await expect(page.locator('article.product-card')).toHaveCount(1);
    await page.getByRole('link', { name: c.name, exact: true }).click();
    await expect(page.getByRole('heading', { name: c.name, exact: true })).toBeVisible();
    await expect(page.getByText('KB-87', { exact: true }).first()).toBeVisible();
    await expect(page.locator('.product-atlas').first()).toBeVisible();
    await expect
      .poll(() =>
        page
          .locator('.product-atlas')
          .first()
          .evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth > 0)
      )
      .toBe(true);
    await page.getByLabel(c.qty, { exact: true }).fill('2');
    await page.getByRole('button', { name: c.add, exact: true }).click();
    await expect(page.getByRole('status')).toContainText(c.name);
    await page.goto('/shop/cart');
    await expect(page.getByRole('heading', { name: c.cart, exact: true })).toBeVisible();
    await expect(page.locator('.stepper span')).toHaveText('2');
    await expect(page.locator('.cart-summary')).toContainText(
      c.locale === 'zh-CN' ? '258.00' : '258,00'
    );
    await page.getByRole('combobox', { name: c.language, exact: true }).selectOption('en');
    await expect(page.getByRole('heading', { name: 'Your cart', exact: true })).toBeVisible();
    await expect(page.locator('.stepper span')).toHaveText('2');
    expect(cartQuantity).toBe(2);
    await page.getByRole('combobox', { name: 'Language', exact: true }).selectOption(c.locale);
    await expect(page.getByRole('heading', { name: c.cart, exact: true })).toBeVisible();
    await page.goto('/shop/orders');
    await expect(page.getByRole('heading', { name: c.orders, exact: true })).toBeVisible();
    await expect(page.getByText('LOCALE-ORDER-1', { exact: true })).toBeVisible();
    await page.getByRole('button', { name: c.pay, exact: true }).click();
    await expect(page.locator('.order-status')).toHaveText(c.paid);
    await page.goto('/account');
    await expect(page.getByRole('heading', { level: 1 })).toContainText(user.name);
    await page
      .getByRole('button', {
        name:
          c.locale === 'fr' ? 'Se déconnecter' : c.locale === 'es' ? 'Cerrar sesión' : '退出登录',
        exact: true
      })
      .click();
    await page.getByLabel(c.email, { exact: true }).fill(user.email);
    await page.getByLabel(c.password, { exact: true }).fill('invalid-fixture-password');
    await page.getByRole('button', { name: c.signIn, exact: true }).click();
    await expect(page.locator('main [role=alert]')).toContainText(c.invalid);
    await page.goto('/');
    await page.setViewportSize({ width: 390, height: 844 });
    await expect(page.locator('article.product-card')).toHaveCount(1);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true
    );
    await page.screenshot({ path: `test-results/commerce-${c.locale}-mobile.png`, fullPage: true });
    await page.setViewportSize({ width: 1280, height: 800 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true
    );
  });
