import { createRequire } from 'node:module';
import { spawn } from 'node:child_process';
const require = createRequire(new URL('../apps/web/package.json', import.meta.url));
const child = spawn(process.execPath, [require.resolve('next/dist/bin/next'), 'build'], {
  stdio: 'inherit',
  env: { ...process.env, ANALYZE: 'true' }
});
child.on('error', (error) => {
  console.error('[analyze] could not start', error.message);
  process.exitCode = 1;
});
child.on('exit', (code) => {
  process.exitCode = code ?? 1;
});
