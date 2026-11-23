'use client';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import type { ApiResponse, ShopProduct } from '@repo/types';
import { ProductMedia } from '@/components/product-media';
import { api } from '@/lib/api';
import { CART_CHANGED_EVENT, formatCents } from '@/lib/shop';
import { categories, categoryOf } from '@/lib/catalog';
import { useShopAuth } from '@/lib/use-shop-auth';

export default function ProductPage() {
  const { sku } = useParams<{ sku: string }>();
  const { state: auth } = useShopAuth();
  const [product, setProduct] = useState<ShopProduct | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let active = true;
    setLoading(true);
    setError('');
    setNotice('');
    setQuantity(1);
    api<ApiResponse<ShopProduct[]>>('/shop/products')
      .then((result) => {
        if (active) setProduct(result.data.find((p) => p.sku === sku) ?? null);
      })
      .catch(() => {
        if (active) setError('We couldn’t load this product. Please try again.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [sku, attempt]);
  async function add() {
    if (!product || busy || auth.status !== 'authed') return;
    setBusy(true);
    setError('');
    setNotice('');
    try {
      await api('/shop/cart', {
        method: 'POST',
        body: JSON.stringify({ sku: product.sku, quantity })
      });
      window.dispatchEvent(new Event(CART_CHANGED_EVENT));
      setNotice(`${product.name} added to your cart.`);
    } catch {
      setError('We couldn’t add this item. Please try again.');
    } finally {
      setBusy(false);
    }
  }
  if (loading)
    return (
      <div className="market-loading" role="status">
        Loading product…
      </div>
    );
  if (!product)
    return (
      <div className="shop-empty">
        <h1>{error ? 'Product unavailable' : 'Product not found'}</h1>
        <p>{error || 'This item may no longer be available in the collection.'}</p>
        {error && (
          <button className="button secondary" onClick={() => setAttempt(attempt + 1)}>
            Retry
          </button>
        )}
        <Link href="/shop" className="market-button">
          Browse all products →
        </Link>
      </div>
    );
  const category = categories.find((c) => c.id === categoryOf(product));
  return (
    <div className="market-detail">
      <nav className="market-breadcrumb" aria-label="Breadcrumb">
        <Link href="/">Home</Link>
        <span>/</span>
        <Link href={'/shop?category=' + category?.id}>{category?.label}</Link>
        <span>/</span>
        <span>{product.name}</span>
      </nav>
      <div className="market-product-detail">
        <section className="market-gallery" aria-label="Product image">
          <ProductMedia name={product.name} priority />
          <p>AI-generated sample image. Actual specifications are shown in the listing.</p>
        </section>
        <section className="market-product-info">
          <p className="market-kicker">{category?.label}</p>
          <h1>{product.name}</h1>
          <p className="market-detail-description">
            {product.description || 'A sample from the Purelamp collection.'}
          </p>
          <div className="market-detail-price">
            {formatCents(product.price)} <span>CNY</span>
          </div>
          <p className="market-detail-stock">
            {product.stock > 0 ? `In stock · ${product.stock} available` : 'Currently sold out'}
          </p>
          <div className="market-detail-specs">
            <div>
              <span>Product code</span>
              <strong>{product.sku}</strong>
            </div>
            <div>
              <span>Listing</span>
              <strong>Sample catalog</strong>
            </div>
          </div>
          {product.stock > 0 && (
            <div className="market-quantity">
              <label htmlFor="product-quantity">Quantity</label>
              <input
                id="product-quantity"
                type="number"
                min={1}
                max={Math.min(product.stock, 99)}
                value={quantity}
                onChange={(e) =>
                  setQuantity(
                    Math.max(
                      1,
                      Math.min(Math.min(product.stock, 99), Math.floor(Number(e.target.value)) || 1)
                    )
                  )
                }
              />
            </div>
          )}
          <div className="market-detail-buy">
            {auth.status === 'authed' ? (
              <button
                className="market-button"
                disabled={busy || product.stock <= 0}
                onClick={() => void add()}
              >
                {product.stock <= 0 ? 'Sold out' : busy ? 'Adding…' : '+ Add to cart'}
              </button>
            ) : (
              <Link className="market-button" href="/account">
                Sign in to add to cart →
              </Link>
            )}
            <Link className="market-button secondary" href="/shop/cart">
              View cart
            </Link>
          </div>
          {error && (
            <p role="alert" className="message error">
              {error}
            </p>
          )}
          <p role="status" className={notice ? 'message success' : 'sr-only'}>
            {notice}
          </p>
          <div className="market-detail-policy">
            <strong>Shopping in preview</strong>
            <p>
              Payments are simulated. Shipping, import charges and return services are not yet
              configured for real orders.
            </p>
            <Link href="/shop/guide">Read the shopping guide →</Link>
          </div>
        </section>
      </div>
      <section className="market-description">
        <h2>About this product</h2>
        <p>{product.description || 'No additional description has been provided.'}</p>
        <dl>
          <dt>SKU</dt>
          <dd>{product.sku}</dd>
          <dt>Price currency</dt>
          <dd>CNY — Chinese yuan</dd>
          <dt>Availability</dt>
          <dd>{product.stock > 0 ? 'Available in the sample catalog' : 'Sold out'}</dd>
        </dl>
      </section>
      <Link href="/shop" className="market-back">
        ← Continue exploring
      </Link>
    </div>
  );
}
