import { defineConfig } from '@playwright/test';
const external = process.env.E2E_BASE_URL;
export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  workers: 1,
  timeout: 120000,
  expect: { timeout: 15000 },
  retries: 0,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: { baseURL: external ?? 'http://localhost:3000', screenshot: 'only-on-failure' },
  webServer: external
    ? undefined
    : [
        {
          command: 'pnpm start',
          cwd: '../api',
          url: 'http://localhost:3001/api/ready',
          reuseExistingServer: false,
          timeout: 120000
        },
        {
          command: 'pnpm start',
          url: 'http://localhost:3000',
          reuseExistingServer: false,
          timeout: 120000
        }
      ]
});
