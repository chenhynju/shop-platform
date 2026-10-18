import type { ReactNode } from 'react';
import { ShopNav } from '@/components/shop-nav';

export default function ShopLayout({ children }: { children: ReactNode }) {
  return (
    <div className="shop-shell">
      <ShopNav />
      <main className="shop-main">{children}</main>
      <footer className="shop-footer">
        <span>PURELAMP © {new Date().getFullYear()}</span>
        <span>Preview store · Sample products · Simulated payments</span>
        <a href="/account">Your account →</a>
      </footer>
    </div>
  );
}
