import type { FastifyInstance } from 'fastify';
import type { PrismaClient } from '@repo/db';
import { publicUser, requireAdmin } from '../lib/auth';
export function userRoutes(app: FastifyInstance, db: PrismaClient) {
  app.get('/api/users', async (req) => {
    requireAdmin(req);
    const users = await db.user.findMany({ orderBy: { createdAt: 'desc' }, take: 100 });
    return { data: users.map(publicUser) };
  });
}
