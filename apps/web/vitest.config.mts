import { defineConfig } from 'vitest/config';

export default defineConfig({
  server: { hmr: false },
  test: {
    environment: 'node',
    exclude: ['node_modules/**', 'dist/**', '.next/**', 'e2e/**', 'e2e-pilots/**'],
    coverage: {
      provider: 'v8',
      include: ['lib/**'],
      thresholds: {
        lines: 80,
        statements: 80,
        functions: 80,
        branches: 50
      }
    }
  }
});
