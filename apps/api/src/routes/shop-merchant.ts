import type { FastifyPluginAsync } from 'fastify';
import type { PrismaClient } from '@repo/db';
import { z } from 'zod';
import { sellerAccess } from '../lib/portal-access';
import { AppError } from '../lib/errors';
import { initStock, redis, stockKey } from '../lib/redis';

const productFields = {
  name: z.string().trim().min(1).max(120),
  description: z.string().max(2000),
  price: z.number().int().min(1).max(100000000),
  status: z.enum(['ACTIVE', 'OFFLINE'])
};
const createProduct = z
  .object({
    ...productFields,
    description: productFields.description.default(''),
    status: productFields.status.default('ACTIVE'),
    sku: z.string().regex(/^[A-Za-z0-9_-]{2,64}$/),
    stock: z.number().int().min(0).max(1000000)
  })
  .strict();
const updateProduct = z
  .object(productFields)
  .partial()
  .strict()
  .refine((v) => Object.keys(v).length > 0);
const restock = z.object({ quantity: z.number().int().min(1).max(1000000) }).strict();

export const shopMerchantRoutes: FastifyPluginAsync<{ db: PrismaClient }> = async (app, { db }) => {
  app.addHook('onRequest', async (req) => {
    const { membership } = await sellerAccess(db, req);
    const fulfillment = req.url.includes('/orders');
    if (
      req.method !== 'GET' &&
      membership.role !== 'OWNER' &&
      membership.role !== (fulfillment ? 'FULFILLMENT' : 'CATALOG')
    )
      throw new AppError(403, 'FORBIDDEN', 'Your membership cannot perform this action.');
  });
  app.get('/api/shop/merchant/products', async (req) => {
    const { merchantId } = await sellerAccess(db, req);
    const rows = await db.product.findMany({
      where: { merchantId },
      include: { inventory: true },
      orderBy: { id: 'desc' }
    });
    return {
      data: rows.map((p) => ({
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
  app.post('/api/shop/merchant/products', async (req, reply) => {
    const { merchantId } = await sellerAccess(db, req);
    const parsed = createProduct.safeParse(req.body);
    if (!parsed.success) throw new AppError(400, 'INVALID_INPUT', 'Enter valid product details.');
    const { stock, ...data } = parsed.data;
    const store = await db.store.findFirst({
      where: { merchantId, status: 'ACTIVE' },
      orderBy: { id: 'asc' }
    });
    if (!store) throw new AppError(409, 'CONFLICT', 'An active store is required.');
    const product = await db.$transaction(async (tx) => {
      const created = await tx.product.create({
        data: {
          ...data,
          merchantId,
          storeId: store.id,
          inventory: { create: { sku: data.sku, stock } }
        }
      });
      await tx.commerceAudit.create({
        data: {
          actorId: req.currentUser!.id,
          audience: 'seller',
          merchantId,
          action: 'PRODUCT_CREATED',
          target: data.sku
        }
      });
      return created;
    });
    await initStock(product.sku, stock);
    return reply.code(201).send({ data: { id: product.id, sku: product.sku } });
  });
  app.patch('/api/shop/merchant/products/:sku', async (req) => {
    const { merchantId } = await sellerAccess(db, req);
    const { sku } = req.params as { sku: string };
    const parsed = updateProduct.safeParse(req.body);
    if (!parsed.success) throw new AppError(400, 'INVALID_INPUT', 'Enter valid product changes.');
    await db.$transaction(async (tx) => {
      const result = await tx.product.updateMany({ where: { sku, merchantId }, data: parsed.data });
      if (!result.count) throw new AppError(404, 'NOT_FOUND', 'Product not found.');
      await tx.commerceAudit.create({
        data: {
          actorId: req.currentUser!.id,
          audience: 'seller',
          merchantId,
          action: 'PRODUCT_UPDATED',
          target: sku
        }
      });
    });
    return { data: { sku, ...parsed.data } };
  });
  app.post('/api/shop/merchant/products/:sku/restock', async (req) => {
    const { merchantId } = await sellerAccess(db, req);
    const { sku } = req.params as { sku: string };
    const parsed = restock.safeParse(req.body);
    if (!parsed.success)
      throw new AppError(400, 'INVALID_INPUT', 'Enter a positive stock quantity.');
    const inventory = await db.$transaction(async (tx) => {
      const product = await tx.product.findFirst({ where: { sku, merchantId } });
      if (!product) throw new AppError(404, 'NOT_FOUND', 'Product not found.');
      return tx.inventory.update({
        where: { sku },
        data: { stock: { increment: parsed.data.quantity }, version: { increment: 1 } }
      });
    });
    await redis.eval(
      "if redis.call('EXISTS', KEYS[1]) == 0 then redis.call('SET', KEYS[1], ARGV[2]); return tonumber(ARGV[2]) else return redis.call('INCRBY', KEYS[1], ARGV[1]) end",
      1,
      stockKey(sku),
      parsed.data.quantity,
      inventory.stock
    );
    return { data: { sku, stock: inventory.stock } };
  });
  // Return only this merchant's line items, never the other shops' lines or order total.
  app.get('/api/shop/merchant/orders', async (req) => {
    const { merchantId } = await sellerAccess(db, req);
    const orders = await db.order.findMany({
      where: { items: { some: { merchantId } } },
      include: { items: { where: { merchantId } } },
      orderBy: { id: 'desc' },
      take: 100
    });
    return {
      data: orders.map((o) => ({
        orderNo: o.orderNo,
        status: o.status,
        createdAt: o.createdAt.toISOString(),
        subtotal: o.items.reduce((n, i) => n + i.price * i.quantity, 0),
        items: o.items.map((i) => ({
          id: i.id,
          sku: i.sku,
          name: i.name,
          price: i.price,
          quantity: i.quantity,
          fulfillmentStatus: i.fulfillmentStatus
        }))
      }))
    };
  });
  app.post('/api/shop/merchant/orders/:orderNo/fulfill', async (req) => {
    const { merchantId } = await sellerAccess(db, req);
    const { orderNo } = req.params as { orderNo: string };
    await db.$transaction(async (tx) => {
      const order = await tx.order.findFirst({
        where: { orderNo, items: { some: { merchantId } } }
      });
      if (!order) throw new AppError(404, 'NOT_FOUND', 'Order not found.');
      // Serialize fulfillment across shops before checking whether every line has shipped.
      await tx.$queryRaw`SELECT id FROM "Order" WHERE id = ${order.id} FOR UPDATE`;
      const current = await tx.order.findUniqueOrThrow({ where: { id: order.id } });
      if (!['PAID', 'FULFILLED'].includes(current.status))
        throw new AppError(409, 'CONFLICT', 'Only paid orders can be fulfilled.');
      await tx.orderItem.updateMany({
        where: { orderId: order.id, merchantId },
        data: { fulfillmentStatus: 'FULFILLED' }
      });
      await tx.commerceAudit.create({
        data: {
          actorId: req.currentUser!.id,
          audience: 'seller',
          merchantId,
          action: 'ORDER_LINES_FULFILLED',
          target: orderNo
        }
      });
      // Each merchant completes only their own lines. Buyer status stays PAID until all lines ship.
      const remaining = await tx.orderItem.count({
        where: { orderId: order.id, fulfillmentStatus: { not: 'FULFILLED' } }
      });
      if (!remaining)
        await tx.order.update({ where: { id: order.id }, data: { status: 'FULFILLED' } });
    });
    return { data: { orderNo, fulfillmentStatus: 'FULFILLED' } };
  });
};
