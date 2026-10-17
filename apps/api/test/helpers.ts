import { readdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { randomBytes } from 'node:crypto';
import { PrismaClient } from '@repo/db';
import { buildApp } from '../src/app';

export const mutationHeaders = { 'x-csrf-protection': '1', origin: 'http://localhost:3000' };

// 每个测试 fixture 使用独立的 Postgres schema，实现并行测试互不干扰；
// CI 与本地都指向同一个 PostgreSQL（DATABASE_URL 由环境变量提供）。
const baseUrl = () =>
  process.env.DATABASE_URL ?? 'postgresql://postgres:postgres@localhost:5432/shop';

export async function fixture(production = false) {
  const schema = `test_${randomBytes(4).toString('hex')}`;
  const base = baseUrl();
  const url = `${base}${base.includes('?') ? '&' : '?'}schema=${schema}`;

  const admin = new PrismaClient({ datasourceUrl: base });
  await admin.$executeRawUnsafe(`CREATE SCHEMA IF NOT EXISTS "${schema}"`);
  await admin.$disconnect();

  const db = new PrismaClient({ datasourceUrl: url });
  const migrationsRoot = resolve('../../packages/db/prisma/migrations');
  const migrations = readdirSync(migrationsRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();
  for (const migration of migrations) {
    const sql = readFileSync(join(migrationsRoot, migration, 'migration.sql'), 'utf8');
    for (const statement of sql.split(';').filter((value) => value.trim())) {
      await db.$executeRawUnsafe(statement);
    }
  }

  const app = await buildApp({
    db,
    logger: false,
    env: {
      NODE_ENV: production ? 'production' : 'test',
      DATABASE_URL: url,
      APP_ORIGIN: production ? 'https://toolkit.example.com' : 'http://localhost:3000'
    }
  });
  await app.ready();

  return {
    app,
    db,
    url,
    async close() {
      await app.close();
      await db.$disconnect();
      const cleanup = new PrismaClient({ datasourceUrl: base });
      await cleanup.$executeRawUnsafe(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
      await cleanup.$disconnect();
    }
  };
}
