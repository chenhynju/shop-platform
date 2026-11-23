import type { ReactNode } from 'react';
import { ShopNav } from '@/components/shop-nav';
import './marketplace.css';

export default function ShopLayout({ children }: { children: ReactNode }) {
  return (
    <div className="shop-shell">
      <ShopNav />
      <main className="shop-main">{children}</main>
      <footer className="market-footer">
        <div className="market-footer-inner">
          <div>
            <strong>
              purelamp<span>.</span>
            </strong>
            <p>Everyday finds. A world of possibilities.</p>
            <small>Preview marketplace · Simulated payments</small>
          </div>
          <div>
            <h2>Explore</h2>
            <a href="/shop">All products</a>
            <a href="/shop?category=tech">Tech & accessories</a>
            <a href="/shop?category=home">Home & living</a>
          </div>
          <div>
            <h2>Your shopping</h2>
            <a href="/account">Your account</a>
            <a href="/shop/cart">Shopping cart</a>
            <a href="/shop/orders">Your orders</a>
          </div>
          <div>
            <h2>Good to know</h2>
            <a href="/shop/guide">Shopping guide</a>
            <p>
              Sample prices in CNY.
              <br />
              Real delivery is not yet available.
            </p>
          </div>
        </div>
        <div className="market-footer-bottom">
          © {new Date().getFullYear()} Purelamp{' '}
          <span>AI-generated sample imagery · Preview release</span>
        </div>
      </footer>
    </div>
  );
}
