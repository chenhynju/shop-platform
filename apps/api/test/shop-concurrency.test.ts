// 并发防超卖测试（需要真实 Redis：跑测试前设置 REDIS_URL）
// 例：$env:REDIS_URL='redis://170.106.161.82:16379'; pnpm --filter @repo/api test
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { prisma } from '@repo/db';
import { buildApp } from '../src/app';
import { getRedisStock, initStock } from '../src/lib/redis';

const SKU = 'CONC-TEST-001';
const STOCK = 10;
const CONCURRENCY = 50;

describe('并发防超卖（Redis 原子预扣 + DB 事务）', () => {
  let app: Awaited<ReturnType<typeof buildApp>>;
  let userId = 0;
  let cookie = '';
  let productId = 0;

  beforeAll(async () => {
    app = await buildApp({ logger: false });
    await app.ready();

    // 注册测试用户并登录（拿会话 cookie）；CSRF 头为底座安全设计所要求
    const email = `conctest-${Date.now()}@example.com`;
    const csrf = { 'x-csrf-protection': '1' };
    const reg = await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      headers: csrf,
      payload: { email, password: 'conctest-password-123', name: 'Concurrency' }
    });
    expect(reg.statusCode).toBe(201);
    userId = (reg.json() as { data: { id: number } }).data.id;
    const setCookie = reg.headers['set-cookie'];
    cookie = (Array.isArray(setCookie) ? setCookie[0] : (setCookie ?? '')).split(';')[0] ?? '';

    // 直接建商品与库存（绕过 admin 权限），同步 Redis 可售库存
    const product = await prisma.product.create({
      data: { sku: SKU, name: 'Concurrency Test Product', price: 1000 }
    });
    productId = product.id;
    await prisma.inventory.create({ data: { productId: product.id, sku: SKU, stock: STOCK } });
    await initStock(SKU, STOCK);
    expect(await getRedisStock(SKU)).toBe(STOCK);
  });

  it(`50 个并发下单仅 ${STOCK} 个成功，且 DB 与 Redis 库存归零`, async () => {
    const results = await Promise.all(
      Array.from({ length: CONCURRENCY }, () =>
        app.inject({
          method: 'POST',
          url: '/api/shop/orders',
          headers: { cookie, 'x-csrf-protection': '1' },
          payload: { items: [{ sku: SKU, quantity: 1 }] }
        })
      )
    );
    const created = results.filter((r) => r.statusCode === 201);
    const noStock = results.filter((r) => r.statusCode === 409);

    expect(created.length).toBe(STOCK);
    expect(noStock.length).toBe(CONCURRENCY - STOCK);

    const inventory = await prisma.inventory.findUnique({ where: { sku: SKU } });
    expect(inventory?.stock).toBe(0);
    expect(await getRedisStock(SKU)).toBe(0);

    // 订单金额正确性抽查
    const orderCount = await prisma.order.count({ where: { userId } });
    expect(orderCount).toBe(STOCK);
  });

  it('促销码 PERCENT_OFF 生效（补货后验证）', async () => {
    await initStock(SKU, 5);
    await prisma.inventory.update({
      where: { sku: SKU },
      data: { stock: 5, version: { increment: 1 } }
    });
    await prisma.promotion.upsert({
      where: { code: 'TEST50' },
      update: { type: 'PERCENT_OFF', value: 50, active: true },
      create: { code: 'TEST50', type: 'PERCENT_OFF', value: 50, active: true }
    });
    const res = await app.inject({
      method: 'POST',
      url: '/api/shop/orders',
      headers: { cookie, 'x-csrf-protection': '1' },
      payload: { items: [{ sku: SKU, quantity: 1 }], promoCode: 'TEST50' }
    });
    expect(res.statusCode).toBe(201);
    const order = (res.json() as { data: { total: number } }).data;
    expect(order.total).toBe(500); // 1000 分 × 50% = 500 分
  });

  it('库存不足返回 409 NO_STOCK 且不产生订单', async () => {
    const before = await prisma.order.count({ where: { userId } });
    const res = await app.inject({
      method: 'POST',
      url: '/api/shop/orders',
      headers: { cookie, 'x-csrf-protection': '1' },
      payload: { items: [{ sku: SKU, quantity: 999 }] }
    });
    expect(res.statusCode).toBe(409);
    expect((res.json() as { error: { code: string } }).error.code).toBe('NO_STOCK');
    const after = await prisma.order.count({ where: { userId } });
    expect(after).toBe(before);
  });

  afterAll(async () => {
    await app?.close();
    await prisma.order.deleteMany({ where: { userId } });
    await prisma.inventory.deleteMany({ where: { sku: SKU } });
    await prisma.product.deleteMany({ where: { id: productId } });
    await prisma.promotion.deleteMany({ where: { code: 'TEST50' } });
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (user) {
      await prisma.session.deleteMany({ where: { userId } });
      await prisma.user.delete({ where: { id: userId } });
    }
    await prisma.$disconnect();
  });
});
