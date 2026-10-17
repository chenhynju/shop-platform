// Start a built, disposable pilot. Supply its private environment with node --env-file.
import { spawn } from 'node:child_process';
import path from 'node:path';
import fs from 'node:fs';
import net from 'node:net';
const root = path.resolve(process.argv[2] ?? '.local/pilots/invoiceflow');
if (!fs.existsSync(path.join(root, 'pilot-source-manifest.json')))
  throw new Error('Expected a generated pilot, not the original project');
const origin = new URL(process.env.WEB_URL ?? 'http://127.0.0.1:3290');
const apiPort = Number(process.env.APP_PORT ?? 3291);
if (!['127.0.0.1', 'localhost'].includes(origin.hostname) || process.env.APP_HOST !== '127.0.0.1')
  throw new Error('Pilot must bind only to loopback');
if (!process.env.API_ACCESS_KEY || !process.env.DATABASE_URL || process.env.SAAS_ENABLED !== 'true')
  throw new Error('Supply the new private pilot environment');
for (const port of [Number(origin.port), apiPort]) {
  await new Promise((resolve, reject) => {
    const server = net.createServer();
    server.once('error', reject);
    server.listen(port, '127.0.0.1', () => server.close(resolve));
  });
}
const children = [
  spawn(process.execPath, ['dist/main.js'], {
    cwd: path.join(root, 'apps/api'),
    env: { ...process.env, NODE_ENV: 'development' },
    stdio: 'inherit',
    windowsHide: true
  }),
  spawn(
    process.execPath,
    ['node_modules/next/dist/bin/next', 'start', '--hostname', '127.0.0.1', '--port', origin.port],
    {
      cwd: path.join(root, 'apps/web'),
      env: { ...process.env, NODE_ENV: 'production' },
      stdio: 'inherit',
      windowsHide: true
    }
  )
];
let stopping = false;
function stop() {
  if (stopping) return;
  stopping = true;
  for (const child of children) child.kill();
}
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, stop);
for (const child of children) {
  child.on('error', () => {
    console.error('Pilot process failed to start');
    stop();
    process.exitCode = 1;
  });
  child.on('exit', (code) => {
    if (!stopping) {
      console.error('Pilot process ended', code);
      stop();
      process.exitCode = code || 1;
    }
  });
}
console.log('Disposable local pilot:', origin.origin, '(Ctrl+C stops both processes)');
