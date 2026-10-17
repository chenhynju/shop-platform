// BullMQ：订单超时释放队列（消息队列核心）
// 下单后 10 分钟未支付 → 自动取消订单、释放 Redis 预扣、回补 DB 库存。
import { Queue, Worker } from 'bullmq';
import { prisma } from '@repo/db';
import { releaseStock } from './redis';

const REDIS_URL = process.env.REDIS_URL ?? 'redis://localhost:6379';
export const ORDER_TIMEOUT_MS = 10 * 60 * 1000; // 10 分钟
export const JOB_ORDER_TIMEOUT = 'order-timeout';

export const orderQueue = new Queue('shop-orders', { connection: { url: REDIS_URL } });

export interface OrderTimeoutJob {
  orderId: number;
}

export async function enqueueOrderTimeout(
  orderId: number,
  delay = ORDER_TIMEOUT_MS
): Promise<void> {
  await orderQueue.add(JOB_ORDER_TIMEOUT, { orderId } satisfies OrderTimeoutJob, {
    delay,
    removeOnComplete: 100,
    removeOnFail: 100
  });
}

export function startOrderWorker(): Worker {
  const worker = new Worker(
    'shop-orders',
    async (job) => {
      if (job.name === JOB_ORDER_TIMEOUT) {
        const { orderId } = job.data as { orderId: number };
        const order = await prisma.order.findUnique({
          where: { id: orderId },
          include: { items: true, payment: true }
        });
        if (!order || order.status !== 'PENDING') return; // 已支付/已取消则跳过
        await prisma.$transaction([
          prisma.order.update({ where: { id: orderId }, data: { status: 'CANCELLED' } }),
          ...order.items.map((item) =>
            prisma.inventory.update({
              where: { sku: item.sku },
              data: { stock: { increment: item.quantity } }
            })
          )
        ]);
        for (const item of order.items) {
          await releaseStock(item.sku, item.quantity);
        }
        console.log('[shop] order timeout cancelled', { orderId, orderNo: order.orderNo });
      }
    },
    { connection: { url: REDIS_URL }, concurrency: 4 }
  );
  worker.on('failed', (job, err) => {
    console.error('[shop] queue job failed', { jobId: job?.id, name: job?.name, err: String(err) });
  });
  return worker;
}
