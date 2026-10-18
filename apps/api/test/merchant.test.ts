import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { randomBytes } from 'node:crypto';
import { fixture, mutationHeaders } from './helpers';
import { redis, stockKey } from '../src/lib/redis';

describe('merchant isolation with real PostgreSQL and Redis', () => {
  let ctx: Awaited<ReturnType<typeof fixture>>;
  let a: { id: number; cookie: string }, b: typeof a, buyer: typeof a;
  const suffix = randomBytes(5).toString('hex');
  const skuA = `MA-${suffix}`,
    skuB = `MB-${suffix}`;
  const orderNo = `MIXED-${suffix}`;
  const request = (
    cookie: string,
    method: 'GET' | 'POST' | 'PATCH',
    url: string,
    payload?: object
  ) => ctx.app.inject({ method, url, headers: { ...mutationHeaders, cookie }, payload });
  beforeAll(async () => {
    ctx = await fixture();
    const account = async (email: string, role: string) => {
      const res = await ctx.app.inject({
        method: 'POST',
        url: '/api/auth/register',
        headers: mutationHeaders,
        payload: { email, name: role, password: 'merchant-test-password-123' }
      });
      expect(res.statusCode).toBe(201);
      const id = res.json().data.id as number;
      await ctx.db.user.update({ where: { id }, data: { role } });
      if (role === 'MERCHANT') {
        await ctx.db.merchant.create({
          data: {
            id,
            name: email,
            stores: { create: { name: email } },
            members: { create: { userId: id, role: 'OWNER' } }
          }
        });
        const login = await ctx.app.inject({
          method: 'POST',
          url: '/api/seller/auth/login',
          headers: mutationHeaders,
          payload: { email, password: 'merchant-test-password-123' }
        });
        expect(login.statusCode).toBe(200);
        return { id, cookie: String(login.headers['set-cookie']).split(';')[0]! };
      }
      return { id, cookie: String(res.headers['set-cookie']).split(';')[0]! };
    };
    a = await account('merchant-a@example.com', 'MERCHANT');
    b = await account('merchant-b@example.com', 'MERCHANT');
    buyer = await account('buyer@example.com', 'USER');
  });
  afterAll(async () => {
    await redis.del(stockKey(skuA), stockKey(skuB));
    await ctx.close();
  });
  it('rejects anonymous users, buyers and self-assigned registration roles', async () => {
    expect((await ctx.app.inject('/api/shop/merchant/products')).statusCode).toBe(401);
    expect((await request(buyer.cookie, 'GET', '/api/shop/merchant/orders')).statusCode).toBe(401);
    const res = await ctx.app.inject({
      method: 'POST',
      url: '/api/auth/register',
      headers: mutationHeaders,
      payload: {
        email: 'escalate@example.com',
        name: 'No',
        password: 'merchant-test-password-123',
        role: 'MERCHANT'
      }
    });
    expect(res.statusCode).toBe(400);
    expect((await request(a.cookie, 'GET', '/api/seller/auth/me')).json().data.role).toBe(
      'MERCHANT'
    );
    expect((await request(a.cookie, 'GET', '/api/users')).statusCode).toBe(401);
  });
  it('assigns ownership from the session and isolates product listings', async () => {
    for (const [user, sku] of [
      [a, skuA],
      [b, skuB]
    ] as const) {
      const res = await request(user.cookie, 'POST', '/api/shop/merchant/products', {
        sku,
        name: sku,
        price: 1000,
        stock: 5
      });
      expect(res.statusCode).toBe(201);
      expect((await ctx.db.product.findUniqueOrThrow({ where: { sku } })).merchantId).toBe(user.id);
    }
    const listed = (await request(a.cookie, 'GET', '/api/shop/merchant/products')).json().data;
    expect(listed.map((p: { sku: string }) => p.sku)).toEqual([skuA]);
    const spoofed = await request(a.cookie, 'POST', '/api/shop/merchant/products', {
      sku: 'SPOOF',
      name: 'No',
      price: 100,
      stock: 1,
      merchantId: b.id
    });
    expect(spoofed.statusCode).toBe(400);
  });
  it('rejects cross-merchant edits, restocks and the admin mutation bypass', async () => {
    expect(
      (await request(b.cookie, 'PATCH', `/api/shop/merchant/products/${skuA}`, { name: 'Stolen' }))
        .statusCode
    ).toBe(404);
    expect(
      (
        await request(b.cookie, 'POST', `/api/shop/merchant/products/${skuA}/restock`, {
          quantity: 100
        })
      ).statusCode
    ).toBe(404);
    expect(
      (await request(b.cookie, 'POST', `/api/shop/products/${skuA}/restock`, { quantity: 100 }))
        .statusCode
    ).toBe(401);
    expect((await ctx.db.inventory.findUniqueOrThrow({ where: { sku: skuA } })).stock).toBe(5);
    expect(
      (
        await request(a.cookie, 'PATCH', `/api/shop/merchant/products/${skuA}`, {
          merchantId: b.id
        })
      ).statusCode
    ).toBe(400);
  });
  it('supports owned edits and incremental restocking', async () => {
    expect(
      (
        await request(a.cookie, 'PATCH', `/api/shop/merchant/products/${skuA}`, {
          name: 'Updated',
          status: 'OFFLINE'
        })
      ).statusCode
    ).toBe(200);
    expect(
      (
        await request(a.cookie, 'POST', `/api/shop/merchant/products/${skuA}/restock`, {
          quantity: 3
        })
      ).statusCode
    ).toBe(200);
    expect(await redis.get(stockKey(skuA))).toBe('8');
    expect(
      (
        await request(a.cookie, 'POST', `/api/shop/merchant/products/${skuA}/restock`, {
          quantity: -1
        })
      ).statusCode
    ).toBe(400);
  });
  it('returns only owned order lines and no other merchants totals or buyer identity', async () => {
    const products = await ctx.db.product.findMany();
    await ctx.db.order.create({
      data: {
        orderNo,
        userId: buyer.id,
        status: 'PENDING',
        total: 2000,
        items: {
          create: products.map((p) => ({
            productId: p.id,
            merchantId: p.merchantId,
            sku: p.sku,
            name: p.name,
            price: p.price,
            quantity: 1
          }))
        }
      }
    });
    const data = (await request(a.cookie, 'GET', '/api/shop/merchant/orders')).json().data[0];
    expect(data.items.map((i: { sku: string }) => i.sku)).toEqual([skuA]);
    expect(data.subtotal).toBe(1000);
    expect(data).not.toHaveProperty('total');
    expect(data).not.toHaveProperty('userId');
    expect((await request(buyer.cookie, 'GET', '/api/shop/merchant/orders')).statusCode).toBe(401);
    expect(
      (await request(a.cookie, 'POST', `/api/shop/merchant/orders/${orderNo}/fulfill`)).statusCode
    ).toBe(409);
    expect(
      (await request(a.cookie, 'POST', '/api/shop/merchant/orders/other-order/fulfill')).statusCode
    ).toBe(404);
  });
  it('fulfills only owned paid lines, is idempotent, and finishes after all merchants ship', async () => {
    await ctx.db.order.update({ where: { orderNo }, data: { status: 'PAID' } });
    expect(
      (await request(a.cookie, 'POST', `/api/shop/merchant/orders/${orderNo}/fulfill`)).statusCode
    ).toBe(200);
    expect(
      (await ctx.db.orderItem.findFirstOrThrow({ where: { sku: skuB } })).fulfillmentStatus
    ).toBe('PENDING');
    expect((await ctx.db.order.findUniqueOrThrow({ where: { orderNo } })).status).toBe('PAID');
    expect(
      (await request(a.cookie, 'POST', `/api/shop/merchant/orders/${orderNo}/fulfill`)).statusCode
    ).toBe(200);
    expect(
      (await request(b.cookie, 'POST', `/api/shop/merchant/orders/${orderNo}/fulfill`)).statusCode
    ).toBe(200);
    expect((await ctx.db.order.findUniqueOrThrow({ where: { orderNo } })).status).toBe('FULFILLED');
  });
});
