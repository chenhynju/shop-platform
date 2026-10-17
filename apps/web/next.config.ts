import type { NextConfig } from 'next';
import bundleAnalyzer from '@next/bundle-analyzer';
import path from 'node:path';
const withBundleAnalyzer = bundleAnalyzer({ enabled: process.env.ANALYZE === 'true' });
const API_INTERNAL_URL = process.env.API_INTERNAL_URL ?? 'http://127.0.0.1:3001';
const nextConfig: NextConfig = {
  output: process.env.BUILD_STANDALONE === '1' ? 'standalone' : undefined,
  outputFileTracingRoot: path.join(process.cwd(), '../..'),
  outputFileTracingExcludes: {
    '*': ['../../.local/**/*', '../../examples/**/*', './e2e/**/*', './e2e-pilots/**/*']
  },
  poweredByHeader: false,
  transpilePackages: ['@repo/ui'],
  experimental: { cpus: 1 },
  async rewrites() {
    return [{ source: '/api/:path*', destination: API_INTERNAL_URL + '/api/:path*' }];
  },
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' }
        ]
      }
    ];
  }
};
export default withBundleAnalyzer(nextConfig);
