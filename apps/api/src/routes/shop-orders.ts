// 订单核心路由：下单（Redis 原子预扣 + DB 事务 + 乐观锁）与 mock 支付回调（幂等）
// 一致性设计：
//   1) Redis Lua 原子预扣全部 SKU（任一不足则回滚已扣项）；
//   2) DB 事务内用乐观锁条件更新库存（updateMany where stock >= qty，0 行即失败），
//      并创建订单与支付单；DB 失败则回补 Redis；
//   3) BullMQ 延迟任务兜底：10 分钟未支付自动取消并双端回补。
import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import type { PrismaClient } from '@repo/db';
import { deductStock, releaseStock } from '../lib/redis';
import { enqueueOrderTimeout } from '../lib/queue';
import { requireUser } from '../lib/auth';
import type { ApiResponse, OrderView, PaymentView, PromotionInfo } from '@repo/types';

const createOrderSchema = z.object({
  items: z
    .array(z.object({ sku: z.string().min(1), quantity: z.number().int().min(1) }))
    .min(1)
    .max(20),
  promoCode: z.string().max(64).optional()
});

function makeOrderNo(): string {
  return `SO${Date.now()}${Math.floor(Math.random() * 1e6)
    .toString()
    .padStart(6, '0')}`;
}

// 促销计算：返回优惠后总价与命中的促销
async function applyPromotion(prisma: PrismaClient, total: number, promoCode?: string) {
  if (!promoCode) return { total, promotion: null as PromotionInfo | null };
  const promo = await prisma.promotion.findUnique({ where: { code: promoCode, active: true } });
  if (!promo) return { total, promotion: null };
  let discounted = total;
  if (promo.type === 'FIXED_DISCOUNT') {
    discounted = Math.max(0, total - promo.value);
  } else if (promo.type === 'PERCENT_OFF') {
    discounted = Math.round((total * (100 - promo.value)) / 100);
  } else if (promo.type === 'FULL_REDUCTION') {
    if (promo.threshold === null || total >= promo.threshold) {
      discounted = Math.max(0, total - promo.value);
    }
  }
  return {
    total: discounted,
    promotion: {
      code: promo.code,
      type: promo.type as PromotionInfo['type'],
      value: promo.value,
      threshold: promo.threshold,
      active: promo.active
    } satisfies PromotionInfo
  };
}

async function toOrderView(prisma: PrismaClient, orderId: number): Promise<OrderView> {
  const order = await prisma.order.findUniqueOrThrow({
    where: { id: orderId },
    include: { items: true }
  });
  return {
    id: order.id,
    orderNo: order.orderNo,
    status: order.status as OrderView['status'],
    total: order.total,
    items: order.items.map((i) => ({
      sku: i.sku,
      name: i.name,
      price: i.price,
      quantity: i.quantity
    })),
    createdAt: order.createdAt.toISOString()
  };
}

export const shopOrderRoutes: FastifyPluginAsync<{ db: PrismaClient }> = async (
  app,
  { db: prisma }
) => {
  app.addHook('onRequest', async (req) => {
    requireUser(req);
  });

  // 下单
  app.post('/api/shop/orders', async (req, reply): Promise<ApiResponse<OrderView>> => {
    const user = requireUser(req);
    const parsed = createOrderSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply
        .code(400)
        .send({ error: { code: 'BAD_REQUEST', message: parsed.error.message } });
    }
    const { items, promoCode } = parsed.data;
    const skus = items.map((i) => i.sku);
    const products = await prisma.product.findMany({
      where: { sku: { in: skus }, status: 'ACTIVE' },
      include: { inventory: true }
    });
    const bySku = new Map(products.map((p) => [p.sku, p]));
    for (const item of items) {
      const product = bySku.get(item.sku);
      if (!product || !product.inventory) {
        return reply
          .code(404)
          .send({ error: { code: 'NOT_FOUND', message: `商品 ${item.sku} 不存在或已下架` } });
      }
    }

    // ① Redis 原子预扣（可回滚）
    const deducted: { sku: string; quantity: number }[] = [];
    for (const item of items) {
      const result = await deductStock(item.sku, item.quantity);
      if (result !== 'OK') {
        for (const done of deducted) await releaseStock(done.sku, done.quantity);
        return reply
          .code(409)
          .send({ error: { code: 'NO_STOCK', message: `商品 ${item.sku} 库存不足` } });
      }
      deducted.push(item);
    }

    // ② 促销计算
    const subtotal = items.reduce(
      (sum, item) => sum + (bySku.get(item.sku)?.price ?? 0) * item.quantity,
      0
    );
    const { total, promotion } = await applyPromotion(prisma, subtotal, promoCode);

    // ③ DB 事务：乐观锁扣库存 + 建订单 + 建支付单
    // timeout：跨地域部署/隧道延迟下默认 5s 不足，放宽到 30s
    try {
      const orderId = await prisma.$transaction(
        async (tx) => {
          for (const item of items) {
            const updated = await tx.inventory.updateMany({
              where: { sku: item.sku, stock: { gte: item.quantity } },
              data: { stock: { decrement: item.quantity }, version: { increment: 1 } }
            });
            if (updated.count === 0) throw new Error(`CONCURRENT_SOLD_OUT:${item.sku}`);
          }
          const order = await tx.order.create({
            data: {
              orderNo: makeOrderNo(),
              userId: user.id,
              status: 'PENDING',
              total,
              items: {
                create: items.map((item) => {
                  const product = bySku.get(item.sku)!;
                  return {
                    productId: product.id,
                    sku: item.sku,
                    name: product.name,
                    price: product.price,
                    quantity: item.quantity,
                    merchantId: product.merchantId
                  };
                })
              },
              payment: { create: { amount: total, status: 'CREATED' } }
            }
          });
          return order.id;
        },
        { timeout: 30000 }
      );

      // ④ 超时兜底任务
      await enqueueOrderTimeout(orderId);

      // 下单后清空购物车对应项
      const { cartSet } = await import('../lib/redis');
      const { cartGet } = await import('../lib/redis');
      const cart = await cartGet(user.id);
      for (const item of items) {
        const remaining = (cart[item.sku] ?? 0) - item.quantity;
        await cartSet(user.id, item.sku, remaining > 0 ? remaining : 0);
      }

      void promotion;
      reply.code(201);
      return { data: await toOrderView(prisma, orderId) };
    } catch (error) {
      // DB 失败 → 回补 Redis
      for (const done of deducted) await releaseStock(done.sku, done.quantity);
      const message = error instanceof Error ? error.message : 'order failed';
      if (message.startsWith('CONCURRENT_SOLD_OUT')) {
        return reply
          .code(409)
          .send({ error: { code: 'NO_STOCK', message: '库存并发冲突，请重试' } });
      }
      req.log.error({ err: message }, 'order transaction failed');
      return reply.code(500).send({ error: { code: 'ORDER_FAILED', message: '下单失败，请重试' } });
    }
  });

  // 订单列表（当前用户）
  app.get('/api/shop/orders', async (req): Promise<ApiResponse<OrderView[]>> => {
    const user = requireUser(req);
    const orders = await prisma.order.findMany({
      where: { userId: user.id },
      include: { items: true },
      orderBy: { id: 'desc' },
      take: 50
    });
    return {
      data: orders.map((o) => ({
        id: o.id,
        orderNo: o.orderNo,
        status: o.status as OrderView['status'],
        total: o.total,
        items: o.items.map((i) => ({
          sku: i.sku,
          name: i.name,
          price: i.price,
          quantity: i.quantity
        })),
        createdAt: o.createdAt.toISOString()
      }))
    };
  });

  // mock 支付（幂等）：支付网关回调模拟
  app.post(
    '/api/shop/payments/:orderNo/mock-pay',
    async (req, reply): Promise<ApiResponse<PaymentView>> => {
      const user = requireUser(req);
      const { orderNo } = req.params as { orderNo: string };
      const order = await prisma.order.findUnique({
        where: { orderNo },
        include: { payment: true, items: true }
      });
      if (!order || order.userId !== user.id) {
        return reply.code(404).send({ error: { code: 'NOT_FOUND', message: '订单不存在' } });
      }
      if (order.status !== 'PENDING') {
        // 幂等：重复回调直接返回现状
        return {
          data: {
            orderNo,
            amount: order.payment?.amount ?? order.total,
            status: order.payment?.status === 'SUCCESS' ? 'SUCCESS' : 'FAILED',
            paidAt: order.payment?.paidAt?.toISOString() ?? null
          }
        };
      }
      const paidAt = new Date();
      await prisma.$transaction([
        prisma.payment.update({
          where: { orderId: order.id },
          data: { status: 'SUCCESS', paidAt }
        }),
        prisma.order.update({ where: { id: order.id }, data: { status: 'PAID' } })
      ]);
      return {
        data: { orderNo, amount: order.total, status: 'SUCCESS', paidAt: paidAt.toISOString() }
      };
    }
  );

  // mock 支付失败：取消订单并双端回补库存
  app.post(
    '/api/shop/payments/:orderNo/mock-fail',
    async (req, reply): Promise<ApiResponse<PaymentView>> => {
      const user = requireUser(req);
      const { orderNo } = req.params as { orderNo: string };
      const order = await prisma.order.findUnique({ where: { orderNo }, include: { items: true } });
      if (!order || order.userId !== user.id) {
        return reply.code(404).send({ error: { code: 'NOT_FOUND', message: '订单不存在' } });
      }
      if (order.status !== 'PENDING') {
        return reply
          .code(409)
          .send({ error: { code: 'CONFLICT', message: `订单已处于 ${order.status}` } });
      }
      await prisma.$transaction([
        prisma.order.update({ where: { id: order.id }, data: { status: 'CANCELLED' } }),
        prisma.payment.update({ where: { orderId: order.id }, data: { status: 'FAILED' } }),
        ...order.items.map((item) =>
          prisma.inventory.update({
            where: { sku: item.sku },
            data: { stock: { increment: item.quantity }, version: { increment: 1 } }
          })
        )
      ]);
      for (const item of order.items) await releaseStock(item.sku, item.quantity);
      return { data: { orderNo, amount: order.total, status: 'FAILED', paidAt: null } };
    }
  );

  // 取消订单（未支付状态）
  app.post(
    '/api/shop/orders/:orderNo/cancel',
    async (req, reply): Promise<ApiResponse<OrderView>> => {
      const user = requireUser(req);
      const { orderNo } = req.params as { orderNo: string };
      const order = await prisma.order.findUnique({ where: { orderNo }, include: { items: true } });
      if (!order || order.userId !== user.id) {
        return reply.code(404).send({ error: { code: 'NOT_FOUND', message: '订单不存在' } });
      }
      if (order.status !== 'PENDING') {
        return reply
          .code(409)
          .send({ error: { code: 'CONFLICT', message: `订单已处于 ${order.status}` } });
      }
      await prisma.$transaction([
        prisma.order.update({ where: { id: order.id }, data: { status: 'CANCELLED' } }),
        prisma.payment.update({ where: { orderId: order.id }, data: { status: 'FAILED' } }),
        ...order.items.map((item) =>
          prisma.inventory.update({
            where: { sku: item.sku },
            data: { stock: { increment: item.quantity }, version: { increment: 1 } }
          })
        )
      ]);
      for (const item of order.items) await releaseStock(item.sku, item.quantity);
      return { data: await toOrderView(prisma, order.id) };
    }
  );
};
