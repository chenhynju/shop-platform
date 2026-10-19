import type { FastifyPluginAsync } from 'fastify';
import type { PrismaClient } from '@repo/db';
import { z } from 'zod';
import type { AppConfig } from '../lib/config';
import { createSession, publicUser, requireUser, sessionCookie, tokenHash } from '../lib/auth';
import { platformAccess, sellerAccess } from '../lib/portal-access';
import { hashPassword, verifyPassword } from '../lib/password';
import { AppError } from '../lib/errors';

const credentials = z
  .object({
    email: z.string().trim().toLowerCase().email().max(254),
    password: z.string().min(12).max(128)
  })
  .strict();
const dummyHash = hashPassword('portal-invalid-account-password');

export const portalRoutes: FastifyPluginAsync<{ db: PrismaClient; config: AppConfig }> = async (
  app,
  { db, config }
) => {
  for (const audience of ['seller', 'admin'] as const) {
    const base = `/api/${audience}`;
    const access = (req: Parameters<typeof sellerAccess>[1]) =>
      audience === 'seller' ? sellerAccess(db, req) : platformAccess(db, req);
    app.post(
      `${base}/auth/login`,
      { config: { rateLimit: { max: 12, timeWindow: '1 minute' } } },
      async (req, reply) => {
        const parsed = credentials.safeParse(req.body);
        if (!parsed.success) throw new AppError(400, 'INVALID_INPUT', 'Enter valid credentials.');
        const user = await db.user.findUnique({ where: { email: parsed.data.email } });
        const valid = await verifyPassword(
          parsed.data.password,
          user?.passwordHash ?? (await dummyHash)
        );
        if (!user?.passwordHash || !valid)
          throw new AppError(401, 'INVALID_CREDENTIALS', 'Email or password is incorrect.');
        req.currentUser = user;
        await access(req);
        await createSession(db, user.id, reply, config, audience);
        return { data: publicUser(user) };
      }
    );
    app.get(`${base}/auth/me`, async (req) => {
      await access(req);
      return { data: publicUser(requireUser(req)) };
    });
    app.post(`${base}/auth/logout`, async (req, reply) => {
      const cookie = sessionCookie(audience);
      const token = req.cookies[cookie];
      if (token) await db.session.deleteMany({ where: { tokenHash: tokenHash(token), audience } });
      reply.clearCookie(cookie, {
        path: '/',
        httpOnly: true,
        sameSite: 'lax',
        secure: config.NODE_ENV === 'production'
      });
      return reply.code(204).send();
    });
  }
  app.get('/api/seller/context', async (req) => {
    const { membership } = await sellerAccess(db, req);
    return { data: { merchant: membership.merchant, role: membership.role } };
  });
  app.get('/api/admin/overview', async (req) => {
    await platformAccess(db, req);
    const [merchants, products, orders, customers] = await Promise.all([
      db.merchant.count(),
      db.product.count(),
      db.order.count(),
      db.user.count({
        where: { role: 'USER', merchantMemberships: { none: {} }, platformMembership: { is: null } }
      })
    ]);
    return {
      data: {
        merchants,
        products,
        orders,
        customers,
        paymentMode: 'INTERNAL_SIMULATION',
        livePayments: false,
        logistics: 'NOT_CONNECTED'
      }
    };
  });
  app.get('/api/admin/merchants', async (req) => {
    await platformAccess(db, req);
    const rows = await db.merchant.findMany({
      take: 100,
      orderBy: { id: 'asc' },
      include: {
        stores: true,
        members: {
          select: {
            role: true,
            active: true,
            user: { select: { id: true, email: true, name: true } }
          }
        },
        _count: { select: { products: true } }
      }
    });
    return { data: rows };
  });
  app.get('/api/admin/products', async (req) => {
    await platformAccess(db, req);
    return {
      data: await db.product.findMany({
        take: 100,
        orderBy: { id: 'desc' },
        include: { inventory: { select: { stock: true } }, merchant: { select: { name: true } } }
      })
    };
  });
  app.get('/api/admin/orders', async (req) => {
    await platformAccess(db, req);
    return {
      data: await db.order.findMany({
        take: 100,
        orderBy: { id: 'desc' },
        select: {
          orderNo: true,
          status: true,
          total: true,
          createdAt: true,
          items: {
            select: { sku: true, quantity: true, merchantId: true, fulfillmentStatus: true }
          }
        }
      })
    };
  });
  app.get('/api/admin/audit', async (req) => {
    await platformAccess(db, req);
    return { data: await db.commerceAudit.findMany({ take: 100, orderBy: { id: 'desc' } }) };
  });
};
