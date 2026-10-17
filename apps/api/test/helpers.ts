import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve, join } from 'node:path';
import { PrismaClient } from '@repo/db';
import { buildApp } from '../src/app';
export const mutationHeaders = { 'x-csrf-protection': '1', origin: 'http://localhost:3000' };
export async function fixture(production = false) {
  const directory = mkdtempSync(join(tmpdir(), 'toolkit-api-'));
  const url = 'file:' + join(directory, 'test.db').replaceAll('\\', '/');
  const db = new PrismaClient({ datasourceUrl: url });
  for (const migration of ['202610170001_initial', '202610170002_auth_projects']) {
    const sql = readFileSync(
      resolve('../../packages/db/prisma/migrations', migration, 'migration.sql'),
      'utf8'
    );
    for (const statement of sql.split(';').filter((value) => value.trim()))
      await db.$executeRawUnsafe(statement);
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
    async close() {
      await app.close();
      await db.$disconnect();
      rmSync(directory, { recursive: true, force: true });
    }
  };
}
