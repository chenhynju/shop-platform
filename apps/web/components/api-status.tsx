'use client';

import { useEffect, useState } from 'react';
import type { Health } from '@repo/types';

export function ApiStatus() {
  const [health, setHealth] = useState<Health | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    fetch('/api/health')
      .then((res) => res.json())
      .then((data: Health) => {
        if (!cancelled) {
          setHealth(data);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setError('API 未启动（请先运行 pnpm dev）');
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div data-testid="api-status" className="text-sm">
      {error ? (
        <p className="text-red-600">{error}</p>
      ) : health ? (
        <p>
          API 状态：<span className="font-medium text-emerald-600">{health.status}</span>
          <span className="text-slate-400"> · 已运行 {Math.round(health.uptime)}s</span>
        </p>
      ) : (
        <p className="text-slate-400">连接 API 中…</p>
      )}
    </div>
  );
}
