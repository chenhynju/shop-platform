import { defineConfig } from 'vitest/config';
export default defineConfig({
  server: { hmr: false },
  test: {
    testTimeout: 20000,
    hookTimeout: 30000,
    coverage: {
      provider: 'v8',
      include: ['src/lib/**', 'src/routes/**', 'src/app.ts'],
      exclude: ['src/routes/health.ts'],
      thresholds: { lines: 85, statements: 85, functions: 90, branches: 75 }
    }
  }
});
