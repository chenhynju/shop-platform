import { defineConfig } from '@playwright/test';
const baseURL = process.env.PILOT_BASE_URL ?? 'http://127.0.0.1:3290';
const target = new URL(baseURL);
if (!['127.0.0.1', 'localhost'].includes(target.hostname))
  throw new Error('Pilot tests are restricted to a local disposable deployment');
export default defineConfig({
  testDir: './e2e-pilots',
  workers: 1,
  retries: 0,
  timeout: 180000,
  expect: { timeout: 20000 },
  reporter: [['list'], ['html', { outputFolder: 'playwright-pilot-report', open: 'never' }]],
  use: { baseURL, screenshot: 'only-on-failure', trace: 'off' }
});
