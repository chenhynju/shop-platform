// 商品与库存管理路由
import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { prisma } from '@repo/db';
import { initStock, getRedisStock, stockKey, redis } from '../lib/redis';
import { requireAdmin } from '../lib/auth';
import type { ApiResponse, ShopProduct } from '@repo/types';

const createProductSchema = z.object({
  sku: z.string().min(2).max(64),
  name: z.string().min(1).max(120),
  description: z.string().max(2000).optional(),
  price: z.number().int().min(1),
  stock: z.number().int().min(0)
});

export const shopProductRoutes: FastifyPluginAsync = async (app) => {
  // 商品列表（公开）
  app.get('/api/shop/products', async (): Promise<ApiResponse<ShopProduct[]>> => {
    const products = await prisma.product.findMany({
      where: { status: 'ACTIVE' },
      include: { inventory: true },
      orderBy: { id: 'asc' }
    });
    return {
      data: products.map((p) => ({
        id: p.id,
        sku: p.sku,
        name: p.name,
        description: p.description,
        price: p.price,
        status: p.status,
        stock: p.inventory?.stock ?? 0
      }))
    };
  });

  // 创建商品（admin）：DB 建商品 + 库存，同步 Redis 可售库存
  app.post('/api/shop/products', async (req, reply) => {
    requireAdmin(req);
    const parsed = createProductSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply
        .code(400)
        .send({ error: { code: 'BAD_REQUEST', message: parsed.error.message } });
    }
    const { sku, name, description, price, stock } = parsed.data;
    const existing = await prisma.product.findUnique({ where: { sku } });
    if (existing) {
      return reply.code(409).send({ error: { code: 'CONFLICT', message: 'SKU 已存在' } });
    }
    const product = await prisma.$transaction(async (tx) => {
      const created = await tx.product.create({
        data: { sku, name, description: description ?? '', price }
      });
      await tx.inventory.create({ data: { productId: created.id, sku, stock } });
      return created;
    });
    await initStock(sku, stock);
    return reply.code(201).send({ data: { id: product.id, sku: product.sku } });
  });

  // 补充库存（admin）：DB 与 Redis 同步
  app.post('/api/shop/products/:sku/restock', async (req, reply) => {
    requireAdmin(req);
    const { sku } = req.params as { sku: string };
    const body = req.body as { quantity?: number };
    const quantity = Number(body?.quantity);
    if (!Number.isInteger(quantity) || quantity <= 0) {
      return reply
        .code(400)
        .send({ error: { code: 'BAD_REQUEST', message: 'quantity 必须为正整数' } });
    }
    const inventory = await prisma.inventory.findUnique({ where: { sku } });
    if (!inventory) {
      return reply.code(404).send({ error: { code: 'NOT_FOUND', message: 'SKU 不存在' } });
    }
    const updated = await prisma.inventory.update({
      where: { sku },
      data: { stock: { increment: quantity }, version: { increment: 1 } }
    });
    // Redis 可售库存与 DB 对齐（cap 防止历史预扣差异放大）
    await initStock(sku, updated.stock);
    const redisStock = await getRedisStock(sku);
    return { data: { sku, dbStock: updated.stock, redisStock } };
  });

  // 库存探针（并发测试用）
  app.get('/api/shop/products/:sku/stock', async (req, reply) => {
    const { sku } = req.params as { sku: string };
    const inventory = await prisma.inventory.findUnique({ where: { sku } });
    if (!inventory) {
      return reply.code(404).send({ error: { code: 'NOT_FOUND', message: 'SKU 不存在' } });
    }
    const redisStock = await redis.get(stockKey(sku));
    return {
      data: {
        sku,
        dbStock: inventory.stock,
        redisStock: redisStock === null ? null : Number(redisStock)
      }
    };
  });
};
