import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { fixture, mutationHeaders } from './helpers';
import { tokenHash } from '../src/lib/auth';
describe('real database authentication and authorization', () => {
  let ctx: Awaited<ReturnType<typeof fixture>>;
  let alice: string, bob: string, projectId: string;
  const password = 'integration-password-1749';
  beforeAll(async () => {
    ctx = await fixture();
  });
  afterAll(async () => {
    await ctx.close();
  });
  const register = async (email: string, name = 'Test user') =>
    ctx.app.inject({
      method: 'POST',
      url: '/api/auth/register',
      headers: mutationHeaders,
      payload: { email, name, password }
    });
  const cookie = (res: { headers: Record<string, unknown> }) =>
    String(res.headers['set-cookie']).split(';')[0]!;
  it('reports liveness and real database readiness', async () => {
    expect((await ctx.app.inject('/api/health')).json().status).toBe('ok');
    expect((await ctx.app.inject('/api/ready')).json()).toEqual({
      status: 'ok',
      database: 'connected'
    });
  });
  it('rejects anonymous requests with stable errors and request IDs', async () => {
    for (const url of ['/api/projects', '/api/users', '/api/auth/me']) {
      const res = await ctx.app.inject(url);
      expect(res.statusCode).toBe(401);
      expect(res.json().error.code).toBe('UNAUTHENTICATED');
      expect(res.headers['x-request-id']).toBe(res.json().error.requestId);
      expect(res.headers['cache-control']).toBe('no-store');
    }
  });
  it('blocks cross-origin and missing-CSRF mutations', async () => {
    for (const headers of [{}, { ...mutationHeaders, origin: 'https://evil.example' }]) {
      const res = await ctx.app.inject({
        method: 'POST',
        url: '/api/auth/register',
        headers,
        payload: {}
      });
      expect(res.statusCode).toBe(403);
      expect(res.json().error.code).toBe('CSRF_REJECTED');
    }
  });
  it('validates registration and blocks role injection', async () => {
    for (const payload of [
      { email: 'bad', password: 'short' },
      { email: 'role@example.com', password, name: 'Bad role', role: 'ADMIN' }
    ]) {
      const res = await ctx.app.inject({
        method: 'POST',
        url: '/api/auth/register',
        headers: mutationHeaders,
        payload
      });
      expect(res.statusCode).toBe(400);
    }
  });
  it('creates private accounts with salted passwords and token digests', async () => {
    const a = await register('Alice@Example.com', 'Alice');
    alice = cookie(a);
    const b = await register('bob@example.com', 'Bob');
    bob = cookie(b);
    expect(a.statusCode).toBe(201);
    expect(b.statusCode).toBe(201);
    expect(a.json().data).toMatchObject({ email: 'alice@example.com', role: 'USER' });
    expect(a.body).not.toContain('password');
    expect(String(a.headers['set-cookie'])).toContain('HttpOnly');
    expect(String(a.headers['set-cookie'])).toContain('SameSite=Lax');
    const users = await ctx.db.user.findMany();
    expect(users[0]!.passwordHash).not.toBe(users[1]!.passwordHash);
    expect(users[0]!.passwordHash).not.toContain(password);
    const sessions = await ctx.db.session.findMany();
    expect(sessions.some((session) => session.tokenHash === tokenHash(alice.split('=')[1]!))).toBe(
      true
    );
    expect(sessions.some((session) => alice.includes(session.tokenHash))).toBe(false);
    expect(
      (await ctx.app.inject({ url: '/api/auth/me', headers: { cookie: alice } })).statusCode
    ).toBe(200);
  });
  it('maps duplicate emails to a safe conflict', async () => {
    const res = await register('alice@example.com');
    expect(res.statusCode).toBe(409);
    expect(res.json().error.code).toBe('CONFLICT');
    expect(res.body).not.toContain('Prisma');
  });
  it('never accepts credentials for an unknown account or wrong password', async () => {
    for (const email of ['nobody@example.com', 'alice@example.com']) {
      const res = await ctx.app.inject({
        method: 'POST',
        url: '/api/auth/login',
        headers: mutationHeaders,
        payload: { email, password: 'wrong-password-1234' }
      });
      expect(res.statusCode).toBe(401);
      expect(res.json().error.code).toBe('INVALID_CREDENTIALS');
    }
  });
  it('creates and reads owner-scoped projects; validates mutations', async () => {
    const denied = await ctx.app.inject({
      method: 'POST',
      url: '/api/projects',
      headers: { ...mutationHeaders, cookie: alice },
      payload: { title: 'No injection', ownerId: 2 }
    });
    expect(denied.statusCode).toBe(400);
    const created = await ctx.app.inject({
      method: 'POST',
      url: '/api/projects',
      headers: { ...mutationHeaders, cookie: alice },
      payload: { title: 'Ship a template', description: 'Real persistence' }
    });
    expect(created.statusCode).toBe(201);
    projectId = created.json().data.id;
    expect(created.json().data).not.toHaveProperty('ownerId');
    expect(
      (
        await ctx.app.inject({ url: '/api/projects/' + projectId, headers: { cookie: alice } })
      ).json().data.title
    ).toBe('Ship a template');
    const list = await ctx.app.inject({ url: '/api/projects', headers: { cookie: bob } });
    expect(list.json().data).toEqual([]);
  });
  it('blocks another account reading/updating/deleting a known project ID', async () => {
    for (const method of ['GET', 'PATCH', 'DELETE'] as const) {
      const res = await ctx.app.inject({
        method,
        url: '/api/projects/' + projectId,
        headers: { ...mutationHeaders, cookie: bob },
        ...(method === 'PATCH' ? { payload: { title: 'Stolen' } } : {})
      });
      expect(res.statusCode).toBe(404);
    }
    expect((await ctx.db.project.findUniqueOrThrow({ where: { id: projectId } })).title).toBe(
      'Ship a template'
    );
  });
  it('updates owner data and persists it across app restart', async () => {
    const changed = await ctx.app.inject({
      method: 'PATCH',
      url: '/api/projects/' + projectId,
      headers: { ...mutationHeaders, cookie: alice },
      payload: { status: 'DONE', title: 'Template shipped' }
    });
    expect(changed.statusCode).toBe(200);
    expect(changed.json().data.status).toBe('DONE');
    await ctx.app.close();
    const { buildApp } = await import('../src/app');
    ctx.app = await buildApp({
      db: ctx.db,
      logger: false,
      env: { NODE_ENV: 'test', DATABASE_URL: 'file:test.db', APP_ORIGIN: 'http://localhost:3000' }
    });
    const res = await ctx.app.inject({ url: '/api/projects', headers: { cookie: alice } });
    expect(res.json().data[0]).toMatchObject({ title: 'Template shipped', status: 'DONE' });
  });
  it('enforces admin directory permissions and hides hashes', async () => {
    const forbidden = await ctx.app.inject({ url: '/api/users', headers: { cookie: bob } });
    expect(forbidden.statusCode).toBe(403);
    await ctx.db.user.update({ where: { email: 'alice@example.com' }, data: { role: 'ADMIN' } });
    const allowed = await ctx.app.inject({ url: '/api/users', headers: { cookie: alice } });
    expect(allowed.statusCode).toBe(200);
    expect(allowed.json().data.length).toBe(2);
    expect(allowed.body).not.toContain('passwordHash');
  });
  it('rejects empty patches and deletes owned data', async () => {
    const invalid = await ctx.app.inject({
      method: 'PATCH',
      url: '/api/projects/' + projectId,
      headers: { ...mutationHeaders, cookie: alice },
      payload: {}
    });
    expect(invalid.statusCode).toBe(400);
    expect(
      (
        await ctx.app.inject({
          method: 'DELETE',
          url: '/api/projects/' + projectId,
          headers: { ...mutationHeaders, cookie: alice }
        })
      ).statusCode
    ).toBe(204);
    expect((await ctx.db.project.count()).toString()).toBe('0');
  });
  it('revokes logout sessions and rejects expired or tampered sessions', async () => {
    const logout = await ctx.app.inject({
      method: 'POST',
      url: '/api/auth/logout',
      headers: { ...mutationHeaders, cookie: alice }
    });
    expect(logout.statusCode).toBe(204);
    expect(
      (await ctx.app.inject({ url: '/api/auth/me', headers: { cookie: alice } })).statusCode
    ).toBe(401);
    await ctx.db.session.updateMany({ data: { expiresAt: new Date(0) } });
    for (const value of [bob, 'toolkit_session=forged'])
      expect(
        (await ctx.app.inject({ url: '/api/auth/me', headers: { cookie: value } })).statusCode
      ).toBe(401);
    const login = await ctx.app.inject({
      method: 'POST',
      url: '/api/auth/login',
      headers: mutationHeaders,
      payload: { email: 'alice@example.com', password }
    });
    expect(login.statusCode).toBe(200);
  });
  it('sanitizes database failures without exposing internal details', async () => {
    const spy = vi
      .spyOn(ctx.db, '$queryRaw')
      .mockRejectedValueOnce(new Error('private database password and SQL internals'));
    try {
      const response = await ctx.app.inject('/api/ready');
      expect(response.statusCode).toBe(500);
      expect(response.json().error.code).toBe('INTERNAL_ERROR');
      expect(response.json().error.requestId).toBe(response.headers['x-request-id']);
      expect(response.body).not.toContain('private database');
      expect(response.body).not.toContain('SQL internals');
    } finally {
      spy.mockRestore();
    }
  });
  it('formats not-found, malformed JSON and oversized-body errors consistently', async () => {
    const missing = await ctx.app.inject('/api/missing');
    expect(missing.statusCode).toBe(404);
    for (const payload of ['{', JSON.stringify({ body: 'x'.repeat(17000) })]) {
      const res = await ctx.app.inject({
        method: 'POST',
        url: '/api/projects',
        headers: { ...mutationHeaders, 'content-type': 'application/json' },
        payload
      });
      expect(res.statusCode).toBeGreaterThanOrEqual(400);
      expect(res.statusCode).toBeLessThan(500);
      expect(res.json().error.requestId).toBeTruthy();
    }
  });
});
describe('production security and throttling', () => {
  it('sets secure cookies and requires production Origin', async () => {
    const ctx = await fixture(true);
    try {
      const payload = {
        email: 'secure@example.com',
        password: 'production-password-1234',
        name: 'Secure'
      };
      const rejected = await ctx.app.inject({
        method: 'POST',
        url: '/api/auth/register',
        headers: { 'x-csrf-protection': '1' },
        payload
      });
      expect(rejected.statusCode).toBe(403);
      const res = await ctx.app.inject({
        method: 'POST',
        url: '/api/auth/register',
        headers: { 'x-csrf-protection': '1', origin: 'https://toolkit.example.com' },
        payload
      });
      expect(res.statusCode).toBe(201);
      expect(String(res.headers['set-cookie'])).toContain('Secure');
      expect(res.headers['x-content-type-options']).toBe('nosniff');
      expect(res.headers['content-security-policy']).toBeTruthy();
    } finally {
      await ctx.close();
    }
  });
  it('limits repeated login attempts', async () => {
    const ctx = await fixture();
    try {
      let limited = false;
      for (let i = 0; i < 14; i++) {
        const res = await ctx.app.inject({
          method: 'POST',
          url: '/api/auth/login',
          headers: mutationHeaders,
          payload: {}
        });
        if (res.statusCode === 429) {
          expect(res.json().error.code).toBe('RATE_LIMITED');
          limited = true;
        }
      }
      expect(limited).toBe(true);
    } finally {
      await ctx.close();
    }
  });
});
