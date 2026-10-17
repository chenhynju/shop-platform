// 促销规则管理路由（admin 创建/停用促销码）
import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { prisma } from '@repo/db';
import { requireAdmin } from '../lib/auth';
import type { ApiResponse, PromotionInfo } from '@repo/types';

const createPromotionSchema = z.object({
  code: z.string().min(2).max(64),
  type: z.enum(['FIXED_DISCOUNT', 'PERCENT_OFF', 'FULL_REDUCTION']),
  value: z.number().int().min(1),
  threshold: z.number().int().min(1).optional()
});

export const shopPromotionRoutes: FastifyPluginAsync = async (app) => {
  app.get('/api/shop/promotions', async (): Promise<ApiResponse<PromotionInfo[]>> => {
    const promotions = await prisma.promotion.findMany({
      where: { active: true },
      orderBy: { id: 'desc' }
    });
    return {
      data: promotions.map((p) => ({
        code: p.code,
        type: p.type as PromotionInfo['type'],
        value: p.value,
        threshold: p.threshold,
        active: p.active
      }))
    };
  });

  app.post('/api/shop/promotions', async (req, reply) => {
    requireAdmin(req);
    const parsed = createPromotionSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply
        .code(400)
        .send({ error: { code: 'BAD_REQUEST', message: parsed.error.message } });
    }
    const existing = await prisma.promotion.findUnique({ where: { code: parsed.data.code } });
    if (existing) {
      return reply.code(409).send({ error: { code: 'CONFLICT', message: '促销码已存在' } });
    }
    const promo = await prisma.promotion.create({ data: parsed.data });
    return reply.code(201).send({
      data: {
        code: promo.code,
        type: promo.type as PromotionInfo['type'],
        value: promo.value,
        threshold: promo.threshold,
        active: promo.active
      }
    });
  });

  app.post('/api/shop/promotions/:code/toggle', async (req, reply) => {
    requireAdmin(req);
    const { code } = req.params as { code: string };
    const promo = await prisma.promotion.findUnique({ where: { code } });
    if (!promo) {
      return reply.code(404).send({ error: { code: 'NOT_FOUND', message: '促销码不存在' } });
    }
    const updated = await prisma.promotion.update({
      where: { code },
      data: { active: !promo.active }
    });
    return { data: { code, active: updated.active } };
  });
};
