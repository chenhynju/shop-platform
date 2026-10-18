import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { fixture, mutationHeaders } from './helpers';

describe('portal session audiences and revocable memberships', () => {
  let ctx: Awaited<ReturnType<typeof fixture>>;
  let buyerCookie: string, sellerCookie: string, adminCookie: string;
  let sellerId: number, merchantId: number, adminId: number;
  const password = 'isolated-portal-test-password';
  const login = (audience: 'seller' | 'admin', email: string) =>
    ctx.app.inject({
      method: 'POST',
      url: `/api/${audience}/auth/login`,
      headers: mutationHeaders,
      payload: { email, password }
    });
  const get = (url: string, cookie = '') => ctx.app.inject({ url, headers: { cookie } });
  beforeAll(async () => {
    ctx = await fixture();
    const account = async (email: string) => {
      const res = await ctx.app.inject({
        method: 'POST',
        url: '/api/auth/register',
        headers: mutationHeaders,
        payload: { email, name: 'Portal fixture', password }
      });
      expect(res.statusCode).toBe(201);
      return {
        id: res.json().data.id as number,
        cookie: String(res.headers['set-cookie']).split(';')[0]!
      };
    };
    buyerCookie = (await account('portal-buyer@example.test')).cookie;
    sellerId = (await account('portal-seller@example.test')).id;
    adminId = (await account('portal-admin@example.test')).id;
    const merchant = await ctx.db.merchant.create({
      data: {
        name: 'Fixture merchant',
        stores: { create: { name: 'Fixture store' } },
        members: { create: { userId: sellerId, role: 'OWNER' } }
      }
    });
    merchantId = merchant.id;
    await ctx.db.platformMembership.create({ data: { userId: adminId, role: 'VIEWER' } });
    sellerCookie = String(
      (await login('seller', 'portal-seller@example.test')).headers['set-cookie']
    ).split(';')[0]!;
    adminCookie = String(
      (await login('admin', 'portal-admin@example.test')).headers['set-cookie']
    ).split(';')[0]!;
  });
  afterAll(async () => {
    await ctx.close();
  });
  it('does not exchange customer, seller and admin sessions', async () => {
    expect((await get('/api/seller/context', buyerCookie)).statusCode).toBe(401);
    expect((await get('/api/admin/merchants', sellerCookie)).statusCode).toBe(401);
    expect((await get('/api/seller/context', adminCookie)).statusCode).toBe(401);
    expect((await get('/api/auth/me', sellerCookie)).statusCode).toBe(401);
    // Even copying a customer token into the seller cookie name is rejected.
    expect(
      (
        await get(
          '/api/seller/context',
          buyerCookie.replace('toolkit_session', 'shop_seller_session')
        )
      ).statusCode
    ).toBe(401);
    expect((await login('seller', 'portal-buyer@example.test')).statusCode).toBe(403);
    expect((await login('admin', 'portal-seller@example.test')).statusCode).toBe(403);
    expect(
      (
        await ctx.app.inject({
          method: 'POST',
          url: '/api/admin/auth/login',
          headers: mutationHeaders,
          payload: { email: 'portal-admin@example.test', password: 'incorrect-password-123' }
        })
      ).statusCode
    ).toBe(401);
  });
  it('returns only public fields and actual data to a platform viewer', async () => {
    for (const resource of ['overview', 'merchants', 'products', 'orders', 'audit']) {
      const response = await get('/api/admin/' + resource, adminCookie);
      expect(response.statusCode).toBe(200);
      expect(response.body).not.toMatch(/passwordHash|tokenHash/);
    }
    expect(
      (await get('/api/admin/merchants', adminCookie)).json().data[0].members[0].user.email
    ).toBe('portal-seller@example.test');
    expect((await get('/api/seller/context', sellerCookie)).json().data.merchant.id).toBe(
      merchantId
    );
  });
  it('enforces current merchant status and membership on every request', async () => {
    await ctx.db.merchant.update({ where: { id: merchantId }, data: { status: 'SUSPENDED' } });
    expect((await get('/api/shop/merchant/products', sellerCookie)).statusCode).toBe(403);
    await ctx.db.merchant.update({ where: { id: merchantId }, data: { status: 'ACTIVE' } });
    await ctx.db.merchantMembership.updateMany({
      where: { userId: sellerId },
      data: { active: false }
    });
    expect((await get('/api/seller/context', sellerCookie)).statusCode).toBe(403);
    await ctx.db.merchantMembership.updateMany({
      where: { userId: sellerId },
      data: { active: true, role: 'VIEWER' }
    });
    expect(
      (
        await ctx.app.inject({
          method: 'POST',
          url: '/api/shop/merchant/products',
          headers: { ...mutationHeaders, cookie: sellerCookie },
          payload: {}
        })
      ).statusCode
    ).toBe(403);
  });
  it('rejects spoofed merchant context and revokes platform privileges immediately', async () => {
    expect(
      (
        await ctx.app.inject({
          url: '/api/seller/context',
          headers: { cookie: sellerCookie, 'x-merchant-id': '9999999' }
        })
      ).statusCode
    ).toBe(403);
    await ctx.db.platformMembership.update({ where: { userId: adminId }, data: { active: false } });
    expect((await get('/api/admin/orders', adminCookie)).statusCode).toBe(403);
  });
  it('logs out one portal without deleting other audience sessions', async () => {
    const before = await ctx.db.session.count({
      where: { userId: sellerId, audience: 'customer' }
    });
    const res = await ctx.app.inject({
      method: 'POST',
      url: '/api/seller/auth/logout',
      headers: { ...mutationHeaders, cookie: sellerCookie }
    });
    expect(res.statusCode).toBe(204);
    expect((await get('/api/seller/context', sellerCookie)).statusCode).toBe(401);
    expect(await ctx.db.session.count({ where: { userId: sellerId, audience: 'customer' } })).toBe(
      before
    );
  });
});
