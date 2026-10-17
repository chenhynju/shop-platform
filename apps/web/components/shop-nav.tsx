'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import type { ApiResponse, CartItem } from '@repo/types';
import { api } from '@/lib/api';
import { CART_CHANGED_EVENT } from '@/lib/shop';

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

  function isActive(href: string) {
    return href === '/shop' ? pathname === href : pathname.startsWith(href);
  }

  return (
    <header className="shop-header">
      <div className="shop-header-inner">
        <Link href="/shop" className="shop-brand">
          <span className="brand-mark small" aria-hidden="true">
            <span />
            <span />
            <span />
          </span>
          helloWorldA <span className="shop-brand-light">/ store</span>
        </Link>
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
        <div className="shop-header-right">
          <Link href="/" className="shop-back-link">
            ← Workspace
          </Link>
        </div>
      </div>
    </header>
  );
}
