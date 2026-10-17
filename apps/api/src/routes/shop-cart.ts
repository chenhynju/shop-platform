// 购物车路由（Redis hash）
import type { FastifyPluginAsync } from 'fastify';
import { prisma } from '@repo/db';
import { cartAdd, cartClear, cartGet, cartSet } from '../lib/redis';
import { requireUser } from '../lib/auth';
import type { ApiResponse, CartItem } from '@repo/types';

export const shopCartRoutes: FastifyPluginAsync = async (app) => {
  app.addHook('onRequest', async (req) => {
    requireUser(req);
  });

  // 查看购物车（含价格快照）
  app.get('/api/shop/cart', async (req): Promise<ApiResponse<CartItem[]>> => {
    const user = requireUser(req);
    const cart = await cartGet(user.id);
    const skus = Object.keys(cart);
    const products = await prisma.product.findMany({
      where: { sku: { in: skus }, status: 'ACTIVE' }
    });
    const bySku = new Map(products.map((p) => [p.sku, p]));
    const items = skus
      .filter((sku) => bySku.has(sku))
      .map((sku) => ({ sku, quantity: cart[sku] ?? 0 }));
    return { data: items };
  });

  // 加购
  app.post('/api/shop/cart', async (req, reply) => {
    const user = requireUser(req);
    const body = req.body as { sku?: string; quantity?: number };
    const quantity = Number(body?.quantity);
    if (!body?.sku || !Number.isInteger(quantity) || quantity <= 0) {
      return reply.code(400).send({ error: { code: 'BAD_REQUEST', message: 'sku/quantity 无效' } });
    }
    const product = await prisma.product.findUnique({ where: { sku: body.sku, status: 'ACTIVE' } });
    if (!product) {
      return reply.code(404).send({ error: { code: 'NOT_FOUND', message: '商品不存在或已下架' } });
    }
    await cartAdd(user.id, body.sku, quantity);
    const cart = await cartGet(user.id);
    return { data: { sku: body.sku, quantity: cart[body.sku] ?? 0 } };
  });

  // 修改数量（≤0 即移除）
  app.put('/api/shop/cart/:sku', async (req, reply) => {
    const user = requireUser(req);
    const { sku } = req.params as { sku: string };
    const quantity = Number((req.body as { quantity?: number })?.quantity);
    if (!Number.isInteger(quantity)) {
      return reply.code(400).send({ error: { code: 'BAD_REQUEST', message: 'quantity 无效' } });
    }
    await cartSet(user.id, sku, quantity);
    return { data: { sku, quantity: Math.max(0, quantity) } };
  });

  // 清空
  app.delete('/api/shop/cart', async (req) => {
    const user = requireUser(req);
    await cartClear(user.id);
    return { data: { cleared: true } };
  });
};
