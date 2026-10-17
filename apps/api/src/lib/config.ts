import { z } from 'zod';
export function readConfig(env: NodeJS.ProcessEnv = process.env) {
  const schema = z.object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    PORT: z.coerce.number().int().min(1).max(65535).default(3001),
    APP_ORIGIN: z.string().url().default('http://localhost:3000'),
    DATABASE_URL: z.string().min(1),
    TRUST_PROXY: z.string().optional()
  });
  const parsed = schema.safeParse(env);
  if (!parsed.success)
    throw new Error('Invalid environment: check NODE_ENV, PORT, APP_ORIGIN and DATABASE_URL');
  const config = parsed.data;
  const url = new URL(config.APP_ORIGIN);
  if (url.origin !== config.APP_ORIGIN || url.username || url.password)
    throw new Error('APP_ORIGIN must be an exact origin without credentials or path');
  if (config.NODE_ENV === 'production' && (url.protocol !== 'https:' || !env.APP_ORIGIN))
    throw new Error('Production requires an explicit HTTPS APP_ORIGIN');
  const database = new URL(config.DATABASE_URL);
  if (
    !['postgresql:', 'postgres:'].includes(database.protocol) ||
    !database.hostname ||
    database.pathname.length < 2
  )
    throw new Error('DATABASE_URL must be a PostgreSQL URL with a host and database name');
  return config;
}
export type AppConfig = ReturnType<typeof readConfig>;
