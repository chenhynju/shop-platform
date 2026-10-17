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
export const SESSION_COOKIE = 'toolkit_session';
export const tokenHash = (value: string) => createHash('sha256').update(value).digest('hex');
export const publicUser = (user: NonNullable<FastifyRequest['currentUser']>): User => ({
  id: user.id,
  email: user.email,
  name: user.name,
  role: user.role === 'ADMIN' ? ('ADMIN' as const) : ('USER' as const),
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
export async function createSession(
  db: PrismaClient,
  userId: number,
  reply: FastifyReply,
  config: AppConfig
) {
  const token = randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  await db.$transaction([
    db.session.deleteMany({ where: { userId, expiresAt: { lt: new Date() } } }),
    db.session.create({ data: { userId, tokenHash: tokenHash(token), expiresAt } })
  ]);
  reply.setCookie(SESSION_COOKIE, token, {
    path: '/',
    httpOnly: true,
    sameSite: 'lax',
    secure: config.NODE_ENV === 'production',
    maxAge: 7 * 24 * 60 * 60
  });
}
