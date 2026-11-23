import { createHash, randomBytes } from 'node:crypto';
import type { FastifyReply, FastifyRequest } from 'fastify';
import type { PrismaClient } from '@repo/db';
import type { User } from '@repo/types';
import type { AppConfig } from './config';
import { AppError } from './errors';
declare module 'fastify' {
  interface FastifyRequest {
    currentUser: {
      id: number;
      email: string;
      name: string | null;
      role: string;
      createdAt: Date;
    } | null;
  }
}
export type Audience = 'customer' | 'seller' | 'admin';
export const SESSION_COOKIE = 'toolkit_session';
export const sessionCookie = (audience: Audience) =>
  audience === 'customer' ? SESSION_COOKIE : `shop_${audience}_session`;
export function requestAudience(request: FastifyRequest): Audience {
  const path = request.url.split('?')[0]!;
  return path.startsWith('/api/admin/')
    ? 'admin'
    : path.startsWith('/api/seller/') || path.startsWith('/api/shop/merchant/')
      ? 'seller'
      : 'customer';
}
export const tokenHash = (value: string) => createHash('sha256').update(value).digest('hex');
export const publicUser = (user: NonNullable<FastifyRequest['currentUser']>): User => ({
  id: user.id,
  email: user.email,
  name: user.name,
  role: user.role === 'ADMIN' ? 'ADMIN' : user.role === 'MERCHANT' ? 'MERCHANT' : 'USER',
  createdAt: user.createdAt.toISOString()
});
export function requireUser(request: FastifyRequest) {
  if (!request.currentUser)
    throw new AppError(401, 'UNAUTHENTICATED', 'Please sign in to continue.');
  return request.currentUser;
}
export function requireAdmin(request: FastifyRequest) {
  const user = requireUser(request);
  if (user.role !== 'ADMIN')
    throw new AppError(403, 'FORBIDDEN', 'Administrator access is required.');
  return user;
}
export function requireMerchant(request: FastifyRequest) {
  const user = requireUser(request);
  if (user.role !== 'MERCHANT')
    throw new AppError(403, 'FORBIDDEN', 'Merchant access is required.');
  return user;
}
export async function createSession(
  db: PrismaClient,
  userId: number,
  reply: FastifyReply,
  config: AppConfig,
  audience: Audience = 'customer'
) {
  const token = randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  await db.$transaction([
    db.session.deleteMany({ where: { userId, expiresAt: { lt: new Date() } } }),
    db.session.create({ data: { userId, tokenHash: tokenHash(token), expiresAt, audience } })
  ]);
  reply.setCookie(sessionCookie(audience), token, {
    path: '/',
    httpOnly: true,
    sameSite: 'lax',
    secure: config.NODE_ENV === 'production',
    maxAge: 7 * 24 * 60 * 60
  });
}
