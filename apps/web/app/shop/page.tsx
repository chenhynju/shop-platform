'use client';
import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { useLocale } from '@/components/locale-provider';
import { api } from '@/lib/api';
import { localizeError } from '@/lib/localize-error';
import { CART_CHANGED_EVENT, formatCents } from '@/lib/shop';
import { useShopAuth } from '@/lib/use-shop-auth';
import type { ApiResponse, ShopProduct } from '@repo/types';

export default function ShopPage() {
  const { locale } = useLocale();
  const { state: auth } = useShopAuth();
  const [products, setProducts] = useState<ShopProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<unknown>(null);
  const [notice, setNotice] = useState('');
  const [adding, setAdding] = useState<string | null>(null);

  const loadProducts = useCallback(async () => {
    setLoading(true);
    try {
      const result = await api<ApiResponse<ShopProduct[]>>('/shop/products');
      setProducts(result.data);
      setError(null);
    } catch (err) {
      setError(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadProducts();
  }, [loadProducts]);

  const addToCart = useCallback(
    async (product: ShopProduct) => {
      setNotice('');
      if (auth.status !== 'authed') {
        setNotice('Please sign in to add items to your cart.');
        return;
      }
      setAdding(product.sku);
      try {
        await api('/shop/cart', {
          method: 'POST',
          body: JSON.stringify({ sku: product.sku, quantity: 1 })
        });
        window.dispatchEvent(new Event(CART_CHANGED_EVENT));
        setNotice(`${product.name} added to your cart.`);
      } catch (err) {
        setError(err);
      } finally {
        setAdding(null);
      }
    },
    [auth.status]
  );

  return (
    <>
      <div className="page-heading">
        <div>
          <p className="eyebrow">HELLOWORLDA STORE</p>
          <h1>Shop the catalog</h1>
          <p className="subtitle">
            All prices in US dollars. Inventory is reserved the moment an order is created.
          </p>
        </div>
        <span className="foundation-tag">
          <span /> Store / 01
        </span>
      </div>
      {auth.status === 'guest' && (
        <p className="shop-guest-bar">
          You are browsing as a guest. <Link href="/shop/cart">Sign in</Link> to use the cart and
          place orders.
        </p>
      )}
      {Boolean(error) && (
        <div role="alert" className="message error">
          <strong>We couldn’t finish that request.</strong>
          <span>{localizeError(error, locale)}</span>
          <button className="text-button" onClick={() => setError(null)}>
            Dismiss
          </button>
        </div>
      )}
      <div role="status" aria-live="polite" className={notice ? 'message success' : 'sr-only'}>
        {notice || null}
      </div>
      {loading ? (
        <div className="loading-panel">Loading products…</div>
      ) : products.length === 0 ? (
        <div className="shop-empty">
          <strong>No products yet</strong>
          <p>The catalog is empty. Check back soon — new stock lands regularly.</p>
          <button className="button secondary" onClick={() => loadProducts()}>
            Refresh
          </button>
        </div>
      ) : (
        <div className="product-grid">
          {products.map((product) => {
            const soldOut = product.stock <= 0;
            const busy = adding === product.sku;
            return (
              <article className="product-card" key={product.sku}>
                <span className="product-sku">{product.sku}</span>
                <h3>{product.name}</h3>
                <p>{product.description || 'A hand-picked store favorite.'}</p>
                <div className="product-price">{formatCents(product.price)}</div>
                <div className={soldOut ? 'product-stock sold-out' : 'product-stock'}>
                  {soldOut ? 'Sold out' : `${product.stock} in stock`}
                </div>
                <button
                  className="button primary"
                  disabled={soldOut || busy}
                  onClick={() => addToCart(product)}
                >
                  {soldOut ? 'Sold out' : busy ? 'Adding…' : '+ Add to cart'}
                </button>
              </article>
            );
          })}
        </div>
      )}
    </>
  );
}
