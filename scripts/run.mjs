import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { existsSync } from 'node:fs';
const envFile = fileURLToPath(new URL('../.env', import.meta.url));
if (existsSync(envFile)) process.loadEnvFile(envFile);
process.env.DATABASE_URL ??= 'postgresql://postgres:postgres@127.0.0.1:5432/shop';
process.env.REDIS_URL ??= 'redis://127.0.0.1:6379';
process.env.APP_ORIGIN ??= 'http://localhost:3000';
const [command, ...args] = process.argv.slice(2);
if (!command) throw new Error('A command is required');
const child = spawn(command, args, {
  stdio: 'inherit',
  shell: process.platform === 'win32',
  env: process.env
});
child.on('error', (error) => {
  console.error('[runner] command failed', error.message);
  process.exitCode = 1;
});
child.on('exit', (code) => {
  process.exitCode = code ?? 1;
});
