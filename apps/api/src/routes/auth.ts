import type { FastifyInstance } from 'fastify';
import type { PrismaClient } from '@repo/db';
import { z } from 'zod';
import type { AppConfig } from '../lib/config';
import { createSession, publicUser, requireUser, SESSION_COOKIE, tokenHash } from '../lib/auth';
import { hashPassword, verifyPassword } from '../lib/password';
import { AppError } from '../lib/errors';
const email = z.string().trim().toLowerCase().email().max(254);
const credentials = z.object({ email, password: z.string().min(12).max(128) }).strict();
const registration = credentials.extend({ name: z.string().trim().min(1).max(80) }).strict();
const dummyHash = hashPassword('not-a-real-account-password');
export function authRoutes(app: FastifyInstance, db: PrismaClient, config: AppConfig) {
  const limited = { config: { rateLimit: { max: 12, timeWindow: '1 minute' } } };
  app.post('/api/auth/register', limited, async (req, reply) => {
    const parsed = registration.safeParse(req.body);
    if (!parsed.success)
      throw new AppError(
        400,
        'INVALID_INPUT',
        'Enter a name, valid email and password of 12–128 characters.'
      );
    const { password, ...data } = parsed.data;
    const user = await db.user.create({
      data: { ...data, passwordHash: await hashPassword(password) }
    });
    await createSession(db, user.id, reply, config);
    return reply.code(201).send({ data: publicUser(user) });
  });
  app.post('/api/auth/login', limited, async (req, reply) => {
    const parsed = credentials.safeParse(req.body);
    if (!parsed.success)
      throw new AppError(
        400,
        'INVALID_INPUT',
        'Enter a valid email and password of 12–128 characters.'
      );
    const user = await db.user.findUnique({ where: { email: parsed.data.email } });
    const valid = await verifyPassword(
      parsed.data.password,
      user?.passwordHash ?? (await dummyHash)
    );
    if (!user || !user.passwordHash || !valid)
      throw new AppError(401, 'INVALID_CREDENTIALS', 'Email or password is incorrect.');
    await createSession(db, user.id, reply, config);
    return { data: publicUser(user) };
  });
  app.get('/api/auth/me', async (req) => ({ data: publicUser(requireUser(req)) }));
  app.post('/api/auth/logout', async (req, reply) => {
    const token = req.cookies[SESSION_COOKIE];
    if (token) await db.session.deleteMany({ where: { tokenHash: tokenHash(token) } });
    reply.clearCookie(SESSION_COOKIE, {
      path: '/',
      httpOnly: true,
      sameSite: 'lax',
      secure: config.NODE_ENV === 'production'
    });
    return reply.code(204).send();
  });
}
