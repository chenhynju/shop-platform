'use client';
import { useLocale } from '@/components/locale-provider';

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
  const { st: t, sample, locale } = useLocale();
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
        if (active) setError(t('We couldn’t load this product. Please try again.'));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [sku, attempt, t]);
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
      setNotice(
        t('{name} added to your cart.', { name: sample(product.sku, 'name', product.name) })
      );
    } catch {
      setError(t('We couldn’t add this item. Please try again.'));
    } finally {
      setBusy(false);
    }
  }
  if (loading)
    return (
      <div className="market-loading" role="status">
        {t('Loading product…')}{' '}
      </div>
    );
  if (!product)
    return (
      <div className="shop-empty">
        <h1>{error ? t('Product unavailable') : t('Product not found')}</h1>
        <p>{error || t('This item may no longer be available in the collection.')}</p>
        {error && (
          <button className="button secondary" onClick={() => setAttempt(attempt + 1)}>
            {t('Retry')}{' '}
          </button>
        )}
        <Link href="/shop" className="market-button">
          {t('Browse all products →')}{' '}
        </Link>
      </div>
    );
  const category = categories.find((c) => c.id === categoryOf(product));
  return (
    <div className="market-detail">
      <nav className="market-breadcrumb" aria-label={t('Breadcrumb')}>
        <Link href="/">{t('Home')}</Link>
        <span>/</span>
        <Link href={'/shop?category=' + category?.id}>{t(category?.label ?? 'All products')}</Link>
        <span>/</span>
        <span>{sample(product.sku, 'name', product.name)}</span>
      </nav>
      <div className="market-product-detail">
        <section className="market-gallery" aria-label={t('Product image')}>
          <ProductMedia
            label={sample(product.sku, 'name', product.name)}
            name={product.name}
            priority
          />
          <p>{t('AI-generated sample image. Actual specifications are shown in the listing.')}</p>
        </section>
        <section className="market-product-info">
          <p className="market-kicker">{t(category?.label ?? 'All products')}</p>
          <h1>{sample(product.sku, 'name', product.name)}</h1>
          <p className="market-detail-description">
            {sample(product.sku, 'description', product.description) ||
              t('A sample from the Purelamp collection.')}
          </p>
          <div className="market-detail-price">
            {formatCents(product.price, locale)} <span>CNY</span>
          </div>
          <p className="market-detail-stock">
            {product.stock > 0
              ? t('In stock · {count} available', { count: product.stock })
              : t('Currently sold out')}
          </p>
          <div className="market-detail-specs">
            <div>
              <span>{t('Product code')}</span>
              <strong>{product.sku}</strong>
            </div>
            <div>
              <span>{t('Listing')}</span>
              <strong>{t('Sample catalog')}</strong>
            </div>
          </div>
          {product.stock > 0 && (
            <div className="market-quantity">
              <label htmlFor="product-quantity">{t('Quantity')}</label>
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
                {product.stock <= 0 ? t('Sold out') : busy ? t('Adding…') : t('+ Add to cart')}
              </button>
            ) : (
              <Link className="market-button" href="/account">
                {t('Sign in to add to cart →')}{' '}
              </Link>
            )}
            <Link className="market-button secondary" href="/shop/cart">
              {t('View cart')}{' '}
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
            <strong>{t('Shopping in preview')}</strong>
            <p>
              {t(
                'Payments are simulated. Shipping, import charges and return services are not yet configured for real orders.'
              )}{' '}
            </p>
            <Link href="/shop/guide">{t('Read the shopping guide →')}</Link>
          </div>
        </section>
      </div>
      <section className="market-description">
        <h2>{t('About this product')}</h2>
        <p>
          {sample(product.sku, 'description', product.description) ||
            t('No additional description has been provided.')}
        </p>
        <dl>
          <dt>SKU</dt>
          <dd>{product.sku}</dd>
          <dt>{t('Price currency')}</dt>
          <dd>{t('CNY — Chinese yuan')}</dd>
          <dt>{t('Availability')}</dt>
          <dd>{product.stock > 0 ? t('Available in the sample catalog') : t('Sold out')}</dd>
        </dl>
      </section>
      <Link href="/shop" className="market-back">
        {t('← Continue exploring')}{' '}
      </Link>
    </div>
  );
}
