import type { FastifyRequest } from 'fastify';
import type { PrismaClient } from '@repo/db';
import { requireUser } from './auth';
import { AppError } from './errors';

export async function sellerAccess(db: PrismaClient, req: FastifyRequest) {
  const user = requireUser(req);
  const memberships = await db.merchantMembership.findMany({
    where: { userId: user.id, active: true, merchant: { status: 'ACTIVE' } },
    include: { merchant: { include: { stores: { where: { status: 'ACTIVE' } } } } }
  });
  // Never guess a tenant when a user has multiple memberships.
  const requested = req.headers['x-merchant-id'];
  const membership = requested
    ? memberships.find((m) => String(m.merchantId) === requested)
    : memberships.length === 1
      ? memberships[0]
      : undefined;
  if (!membership || !['OWNER', 'CATALOG', 'FULFILLMENT', 'VIEWER'].includes(membership.role))
    throw new AppError(403, 'FORBIDDEN', 'An active merchant membership is required.');
  return { user, membership, merchantId: membership.merchantId };
}

export async function platformAccess(db: PrismaClient, req: FastifyRequest) {
  const user = requireUser(req);
  const membership = await db.platformMembership.findUnique({ where: { userId: user.id } });
  if (!membership?.active || !['VIEWER', 'OPERATOR'].includes(membership.role))
    throw new AppError(403, 'FORBIDDEN', 'Platform membership is required.');
  return { user, membership };
}
