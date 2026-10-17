import type { ReactNode } from 'react';
import { ShopNav } from '@/components/shop-nav';

export default function ShopLayout({ children }: { children: ReactNode }) {
  return (
    <div className="shop-shell">
      <ShopNav />
      <main className="shop-main">{children}</main>
      <footer className="shop-footer">
        <span>helloWorldA / store</span>
        <span>Next.js · Fastify · Prisma · Turborepo</span>
        <span>Built for what comes next. ↗</span>
      </footer>
    </div>
  );
}
