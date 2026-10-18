'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import type { ApiResponse, CartItem } from '@repo/types';
import { api } from '@/lib/api';
import { CART_CHANGED_EVENT } from '@/lib/shop';
import { ShopSearch } from './shop-search';
import { categories } from '@/lib/catalog';

const links = [
  { href: '/shop', label: 'Products' },
  { href: '/shop/cart', label: 'Cart' },
  { href: '/shop/orders', label: 'Orders' }
] as const;

export function ShopNav() {
  const pathname = usePathname();
  const [cartCount, setCartCount] = useState<number | null>(null);

  const loadCartCount = useCallback(() => {
    api<ApiResponse<CartItem[]>>('/shop/cart')
      .then((result) => setCartCount(result.data.reduce((sum, item) => sum + item.quantity, 0)))
      .catch(() => setCartCount(null));
  }, []);

  useEffect(() => {
    loadCartCount();
    window.addEventListener(CART_CHANGED_EVENT, loadCartCount);
    return () => window.removeEventListener(CART_CHANGED_EVENT, loadCartCount);
  }, [loadCartCount]);
  const isActive = (href: string) =>
    href === '/shop'
      ? pathname === '/shop' || pathname === '/' || pathname.startsWith('/shop/product/')
      : pathname.startsWith(href);
  return (
    <>
      <div className="market-topline">
        <span>PURELAMP MARKETPLACE</span>
        <span>Preview catalog · CNY prices · Simulated checkout</span>
      </div>
      <header className="shop-header">
        <div className="shop-header-inner">
          <Link href="/" className="shop-brand" aria-label="Purelamp home">
            <span className="market-logo">p</span>purelamp
            <span className="market-brand-dot">.</span>
          </Link>
          <ShopSearch />
          <nav className="shop-nav" aria-label="Shop navigation">
            {links.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={isActive(link.href) ? 'active' : ''}
                aria-current={isActive(link.href) ? 'page' : undefined}
              >
                {link.label}
                {link.href === '/shop/cart' && cartCount !== null && cartCount > 0 && (
                  <span className="shop-nav-badge">{cartCount}</span>
                )}
              </Link>
            ))}
          </nav>
          <Link href="/account" className="shop-back-link" aria-label="Account">
            Account <span aria-hidden="true">↗</span>
          </Link>
        </div>
        <div className="market-category-nav">
          <div>
            <Link href="/shop" className="market-all">
              ☰ All categories
            </Link>
            {categories.slice(1).map((c) => (
              <Link key={c.id} href={'/shop?category=' + c.id}>
                {c.label}
              </Link>
            ))}
            <Link href="/shop?stock=available">In-stock finds</Link>
            <Link href="/shop/guide">Shopping guide</Link>
          </div>
        </div>
      </header>
    </>
  );
}
