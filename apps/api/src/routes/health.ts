import type { FastifyPluginAsync } from 'fastify';
import type { Health } from '@repo/types';

export const healthRoutes: FastifyPluginAsync = async (app) => {
  app.get('/api/health', async (): Promise<Health> => {
    return {
      status: 'ok',
      uptime: process.uptime(),
      timestamp: new Date().toISOString()
    };
  });
};
