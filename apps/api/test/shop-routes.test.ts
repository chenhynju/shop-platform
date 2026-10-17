import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { fixture, mutationHeaders } from './helpers';

const password = 'integration-password-1749';

describe('shop routes', () => {
  let ctx: Awaited<ReturnType<typeof fixture>>;
  let cookie = '';
  let adminCookie = '';

  const register = async (email: string, name: string) => {
    const res = await ctx.app.inject({
      method: 'POST',
      url: '/api/auth/register',
      headers: mutationHeaders,
      payload: { email, name, password }
    });
    expect(res.statusCode).toBe(201);
    const set = res.headers['set-cookie'];
    const raw = Array.isArray(set) ? set[0] : set;
    return (raw ?? '').split(';')[0] ?? '';
  };

  beforeAll(async () => {
    ctx = await fixture();
    cookie = await register('shopper@example.com', 'Shopper');
    adminCookie = await register('admin@example.com', 'Admin');
    const admin = await ctx.db.user.findUniqueOrThrow({ where: { email: 'admin@example.com' } });
    await ctx.db.user.update({ where: { id: admin.id }, data: { role: 'ADMIN' } });
  });

  afterAll(async () => {
    await ctx.close();
  });

  it('lists products publicly', async () => {
    const res = await ctx.app.inject('/api/shop/products');
    expect(res.statusCode).toBe(200);
    expect(Array.isArray(res.json().data)).toBe(true);
  });

  it('creates products (admin only) and restocks', async () => {
    const body = { sku: 'SHOP-001', name: 'Test Product', price: 1000, stock: 5 };
    const denied = await ctx.app.inject({
      method: 'POST',
      url: '/api/shop/products',
      headers: { ...mutationHeaders, cookie },
      payload: body
    });
    expect(denied.statusCode).toBe(403);

    const created = await ctx.app.inject({
      method: 'POST',
      url: '/api/shop/products',
      headers: { ...mutationHeaders, cookie: adminCookie },
      payload: body
    });
    expect(created.statusCode).toBe(201);

    const duplicate = await ctx.app.inject({
      method: 'POST',
      url: '/api/shop/products',
      headers: { ...mutationHeaders, cookie: adminCookie },
      payload: body
    });
    expect(duplicate.statusCode).toBe(409);

    const restock = await ctx.app.inject({
      method: 'POST',
      url: '/api/shop/products/SHOP-001/restock',
      headers: { ...mutationHeaders, cookie: adminCookie },
      payload: { quantity: 3 }
    });
    expect(restock.statusCode).toBe(200);
    expect(restock.json().data.dbStock).toBe(8);

    const probe = await ctx.app.inject('/api/shop/products/SHOP-001/stock');
    expect(probe.statusCode).toBe(200);
    expect(probe.json().data.dbStock).toBe(8);

    const missing = await ctx.app.inject('/api/shop/products/NOPE/stock');
    expect(missing.statusCode).toBe(404);

    const badRestock = await ctx.app.inject({
      method: 'POST',
      url: '/api/shop/products/SHOP-001/restock',
      headers: { ...mutationHeaders, cookie: adminCookie },
      payload: { quantity: -1 }
    });
    expect(badRestock.statusCode).toBe(400);
  });

  it('cart lifecycle: add, list, update, delete', async () => {
    const add = await ctx.app.inject({
      method: 'POST',
      url: '/api/shop/cart',
      headers: { ...mutationHeaders, cookie },
      payload: { sku: 'SHOP-001', quantity: 2 }
    });
    expect(add.statusCode).toBe(200);

    const list = await ctx.app.inject({ url: '/api/shop/cart', headers: { cookie } });
    expect(list.statusCode).toBe(200);
    expect(list.json().data).toEqual([{ sku: 'SHOP-001', quantity: 2 }]);

    const update = await ctx.app.inject({
      method: 'PUT',
      url: '/api/shop/cart/SHOP-001',
      headers: { ...mutationHeaders, cookie },
      payload: { quantity: 0 }
    });
    expect(update.statusCode).toBe(200);

    const emptied = await ctx.app.inject({ url: '/api/shop/cart', headers: { cookie } });
    expect(emptied.json().data).toEqual([]);

    const unknown = await ctx.app.inject({
      method: 'POST',
      url: '/api/shop/cart',
      headers: { ...mutationHeaders, cookie },
      payload: { sku: 'NOPE', quantity: 1 }
    });
    expect(unknown.statusCode).toBe(404);

    const cleared = await ctx.app.inject({
      method: 'DELETE',
      url: '/api/shop/cart',
      headers: { ...mutationHeaders, cookie }
    });
    expect(cleared.statusCode).toBe(200);
  });

  it('promotions: admin create, list and toggle', async () => {
    const created = await ctx.app.inject({
      method: 'POST',
      url: '/api/shop/promotions',
      headers: { ...mutationHeaders, cookie: adminCookie },
      payload: { code: 'TEN', type: 'PERCENT_OFF', value: 10 }
    });
    expect(created.statusCode).toBe(201);

    const duplicate = await ctx.app.inject({
      method: 'POST',
      url: '/api/shop/promotions',
      headers: { ...mutationHeaders, cookie: adminCookie },
      payload: { code: 'TEN', type: 'PERCENT_OFF', value: 10 }
    });
    expect(duplicate.statusCode).toBe(409);

    const list = await ctx.app.inject('/api/shop/promotions');
    expect(list.statusCode).toBe(200);
    expect(list.json().data.some((p: { code: string }) => p.code === 'TEN')).toBe(true);

    const toggle = await ctx.app.inject({
      method: 'POST',
      url: '/api/shop/promotions/TEN/toggle',
      headers: { ...mutationHeaders, cookie: adminCookie }
    });
    expect(toggle.statusCode).toBe(200);
    expect(toggle.json().data.active).toBe(false);

    const missing = await ctx.app.inject({
      method: 'POST',
      url: '/api/shop/promotions/NOPE/toggle',
      headers: { ...mutationHeaders, cookie: adminCookie }
    });
    expect(missing.statusCode).toBe(404);
  });

  it('orders: create with promo, list, mock pay, cancel and restore stock', async () => {
    const restock = await ctx.app.inject({
      method: 'POST',
      url: '/api/shop/products/SHOP-001/restock',
      headers: { ...mutationHeaders, cookie: adminCookie },
      payload: { quantity: 10 }
    });
    expect(restock.statusCode).toBe(200);
    // 当前库存 8 + 10 = 18

    const order = await ctx.app.inject({
      method: 'POST',
      url: '/api/shop/orders',
      headers: { ...mutationHeaders, cookie },
      payload: { items: [{ sku: 'SHOP-001', quantity: 1 }] }
    });
    expect(order.statusCode).toBe(201);
    const first = order.json().data;

    const list = await ctx.app.inject({ url: '/api/shop/orders', headers: { cookie } });
    expect(list.statusCode).toBe(200);
    expect(list.json().data.some((o: { orderNo: string }) => o.orderNo === first.orderNo)).toBe(
      true
    );

    const pay = await ctx.app.inject({
      method: 'POST',
      url: `/api/shop/payments/${first.orderNo}/mock-pay`,
      headers: { ...mutationHeaders, cookie }
    });
    expect(pay.statusCode).toBe(200);
    expect(pay.json().data.status).toBe('SUCCESS');

    // 幂等：重复支付返回现状
    const payAgain = await ctx.app.inject({
      method: 'POST',
      url: `/api/shop/payments/${first.orderNo}/mock-pay`,
      headers: { ...mutationHeaders, cookie }
    });
    expect(payAgain.statusCode).toBe(200);
    expect(payAgain.json().data.status).toBe('SUCCESS');

    // 已支付订单不可取消
    const cancelPaid = await ctx.app.inject({
      method: 'POST',
      url: `/api/shop/orders/${first.orderNo}/cancel`,
      headers: { ...mutationHeaders, cookie }
    });
    expect(cancelPaid.statusCode).toBe(409);

    // 第二单：使用固定折扣促销，取消并回补库存
    const promo = await ctx.app.inject({
      method: 'POST',
      url: '/api/shop/promotions',
      headers: { ...mutationHeaders, cookie: adminCookie },
      payload: { code: 'SAVE5', type: 'FIXED_DISCOUNT', value: 500 }
    });
    expect(promo.statusCode).toBe(201);

    const order2 = await ctx.app.inject({
      method: 'POST',
      url: '/api/shop/orders',
      headers: { ...mutationHeaders, cookie },
      payload: { items: [{ sku: 'SHOP-001', quantity: 2 }], promoCode: 'SAVE5' }
    });
    expect(order2.statusCode).toBe(201);
    const second = order2.json().data;
    expect(second.total).toBe(1500);

    // 未知促销码被忽略，价格不变
    const order3 = await ctx.app.inject({
      method: 'POST',
      url: '/api/shop/orders',
      headers: { ...mutationHeaders, cookie },
      payload: { items: [{ sku: 'SHOP-001', quantity: 1 }], promoCode: 'NOPE-CODE' }
    });
    expect(order3.statusCode).toBe(201);
    expect(order3.json().data.total).toBe(1000);
    await ctx.app.inject({
      method: 'POST',
      url: `/api/shop/orders/${order3.json().data.orderNo}/cancel`,
      headers: { ...mutationHeaders, cookie }
    });

    const cancel = await ctx.app.inject({
      method: 'POST',
      url: `/api/shop/orders/${second.orderNo}/cancel`,
      headers: { ...mutationHeaders, cookie }
    });
    expect(cancel.statusCode).toBe(200);

    const probe = await ctx.app.inject('/api/shop/products/SHOP-001/stock');
    // 18 - 1（已支付）- 2（取消回补）= 17
    expect(probe.json().data.dbStock).toBe(17);

    // 未登录访问订单 → 401
    const anonymous = await ctx.app.inject('/api/shop/orders');
    expect(anonymous.statusCode).toBe(401);

    // 其他用户不能操作别人的订单
    const otherCookie = await register('other@example.com', 'Other');
    const foreign = await ctx.app.inject({
      method: 'POST',
      url: `/api/shop/orders/${second.orderNo}/cancel`,
      headers: { ...mutationHeaders, cookie: otherCookie }
    });
    expect(foreign.statusCode).toBe(404);
  });
});
