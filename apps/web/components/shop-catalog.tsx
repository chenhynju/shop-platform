'use client';

import Link from 'next/link';
import type { ReactNode } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ProductMedia } from '@/components/product-media';
import { useLocale } from '@/components/locale-provider';
import { api } from '@/lib/api';
import { localizeError } from '@/lib/localize-error';
import { CART_CHANGED_EVENT, formatCents } from '@/lib/shop';
import { categories, categoryOf, productHref } from '@/lib/catalog';
import { useShopAuth } from '@/lib/use-shop-auth';
import type { ApiResponse, ShopProduct } from '@repo/types';

export default function ShopCatalog({ hero, bottom }: { hero: ReactNode; bottom: ReactNode }) {
  const { st: t, sample, locale } = useLocale();
  const { state: auth } = useShopAuth();
  const params = useSearchParams();
  const router = useRouter();
  const query = params.get('q')?.trim() ?? '';
  const category = params.get('category') ?? 'all';
  const sort = params.get('sort') ?? 'featured';
  const inStock = params.get('stock') === 'available';
  const [stockChecked, setStockChecked] = useState(inStock);
  useEffect(() => setStockChecked(inStock), [inStock]);
  const [products, setProducts] = useState<ShopProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<unknown>(null);
  const [notice, setNotice] = useState('');
  const [adding, setAdding] = useState<string | null>(null);
  function filter(key: string, value: string) {
    const next = new URLSearchParams(params.toString());
    if (value) next.set(key, value);
    else next.delete(key);
    router.push('/shop' + (next.size ? '?' + next.toString() : ''), { scroll: false });
  }
  const visibleProducts = useMemo(() => {
    const result = products.filter(
      (p) =>
        (!inStock || p.stock > 0) &&
        (category === 'all' || categoryOf(p) === category) &&
        `${p.name} ${p.description} ${p.sku} ${sample(p.sku, 'name', p.name)} ${sample(p.sku, 'description', p.description)}`
          .toLowerCase()
          .includes(query.toLowerCase())
    );
    if (sort === 'price-low') result.sort((a, b) => a.price - b.price);
    if (sort === 'price-high') result.sort((a, b) => b.price - a.price);
    if (sort === 'name') result.sort((a, b) => a.name.localeCompare(b.name));
    return result;
  }, [products, query, category, sort, inStock, sample]);
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
  async function addToCart(product: ShopProduct) {
    if (adding) return;
    setNotice('');
    if (auth.status !== 'authed') {
      setNotice(t('Please sign in to add items to your cart.'));
      return;
    }
    setAdding(product.sku);
    try {
      await api('/shop/cart', {
        method: 'POST',
        body: JSON.stringify({ sku: product.sku, quantity: 1 })
      });
      window.dispatchEvent(new Event(CART_CHANGED_EVENT));
      setNotice(
        t('{name} added to your cart.', { name: sample(product.sku, 'name', product.name) })
      );
    } catch (err) {
      setError(err);
    } finally {
      setAdding(null);
    }
  }
  const filtered = query || category !== 'all' || inStock;
  return (
    <div className="market-home">
      {!filtered && (
        <>
          {hero}
          <section className="market-category-tiles" aria-label={t('Shop by category')}>
            {categories.map((c) => (
              <Link key={c.id} href={c.id === 'all' ? '/shop' : '/shop?category=' + c.id}>
                <span className="category-symbol" aria-hidden="true">
                  {c.icon}
                </span>
                <div>
                  <strong>{t(c.label)}</strong>
                  <span>
                    {loading
                      ? t('Explore the collection')
                      : t('{count} sample products', {
                          count: products.filter((p) => c.id === 'all' || categoryOf(p) === c.id)
                            .length
                        })}
                  </span>
                </div>
                <span aria-hidden="true">↗</span>
              </Link>
            ))}
          </section>
        </>
      )}
      <div className="market-catalog-heading" id="catalog">
        <div>
          <p className="market-kicker">{t('FIND SOMETHING YOU’LL LOVE')}</p>
          {filtered ? (
            <h1>
              {query
                ? t('Results for “{query}”', { query })
                : t(categories.find((c) => c.id === category)?.label ?? 'Products in stock')}
            </h1>
          ) : (
            <h2>{t('Explore the marketplace')}</h2>
          )}
        </div>
        <span>
          {loading ? t('Loading…') : t('{count} products', { count: visibleProducts.length })}
        </span>
      </div>
      <div className="market-catalog-layout">
        <aside className="market-filters" aria-label={t('Product filters')}>
          <h2>{t('Categories')}</h2>
          {categories.map((c) => (
            <Link
              key={c.id}
              className={category === c.id ? 'selected' : ''}
              href={c.id === 'all' ? '/shop' : '/shop?category=' + c.id}
            >
              {t(c.label)}
              <span>{products.filter((p) => c.id === 'all' || categoryOf(p) === c.id).length}</span>
            </Link>
          ))}
          <div className="market-filter-divider" />
          <h2>{t('Availability')}</h2>
          <label className="catalog-stock">
            <input
              type="checkbox"
              checked={stockChecked}
              onChange={(e) => {
                setStockChecked(e.target.checked);
                filter('stock', e.target.checked ? 'available' : '');
              }}
            />{' '}
            {t('In stock only')}{' '}
          </label>
          <div className="market-filter-info">
            <strong>{t('A first look at Purelamp')}</strong>
            <p>{t('Sample products, real shopping flows. Payments are simulated.')}</p>
            <Link href="/shop/guide">{t('How this preview works →')}</Link>
          </div>
        </aside>
        <section className="market-results" aria-label={t('Product results')}>
          <div className="market-results-toolbar">
            <div className="market-filter-pills">
              <span>{t(categories.find((c) => c.id === category)?.label ?? 'All products')}</span>
              {filtered && <Link href="/shop">{t('Clear filters ×')}</Link>}
            </div>
            <label>
              {t('Sort by')}{' '}
              <select
                aria-label={t('Sort products')}
                value={sort}
                onChange={(e) => filter('sort', e.target.value)}
              >
                <option value="featured">{t('Featured')}</option>
                <option value="price-low">{t('Price: low to high')}</option>
                <option value="price-high">{t('Price: high to low')}</option>
                <option value="name">{t('Name: A–Z')}</option>
              </select>
            </label>
          </div>
          {Boolean(error) && (
            <div role="alert" className="message error">
              <strong>{t('We couldn’t finish that request.')}</strong>
              <span>{localizeError(error, locale, t)}</span>
              <button className="text-button" onClick={() => void loadProducts()}>
                {t('Retry loading products')}{' '}
              </button>
            </div>
          )}
          <div role="status" aria-live="polite" className={notice ? 'message success' : 'sr-only'}>
            {notice || null}
            {notice === t('Please sign in to add items to your cart.') && (
              <Link href="/account">{t('Sign in →')}</Link>
            )}
          </div>
          {loading ? (
            <div className="market-loading" role="status">
              {t('Loading the collection…')}{' '}
            </div>
          ) : visibleProducts.length === 0 ? (
            <div className="shop-empty">
              <strong>
                {products.length
                  ? t('No matching products')
                  : error
                    ? t('Collection unavailable')
                    : t('The collection is coming soon')}
              </strong>
              <p>{t('Try another search or browse all products.')}</p>
              <button
                className="button secondary"
                onClick={() => {
                  router.push('/shop');
                  void loadProducts();
                }}
              >
                {t('Clear filters')}{' '}
              </button>
            </div>
          ) : (
            <div className="product-grid">
              {visibleProducts.map((product) => (
                <article className="product-card" key={product.sku}>
                  <Link
                    className="product-image"
                    href={productHref(product.sku)}
                    aria-label={t('View {name}', {
                      name: sample(product.sku, 'name', product.name)
                    })}
                  >
                    <ProductMedia
                      label={sample(product.sku, 'name', product.name)}
                      name={product.name}
                    />
                    <span
                      className={'market-stock-tag' + (product.stock <= 0 ? ' unavailable' : '')}
                    >
                      {product.stock > 0 ? t('In stock') : t('Sold out')}
                    </span>
                  </Link>
                  <div className="market-product-body">
                    <span className="market-product-category">
                      {t(
                        categories.find((c) => c.id === categoryOf(product))?.label ??
                          'All products'
                      )}
                    </span>
                    <h3>
                      <Link href={productHref(product.sku)}>
                        {sample(product.sku, 'name', product.name)}
                      </Link>
                    </h3>
                    <p>
                      {sample(product.sku, 'description', product.description) ||
                        t('Discover this sample from our first collection.')}
                    </p>
                    <div className="market-price-line">
                      <strong className="product-price">
                        {formatCents(product.price, locale)}
                      </strong>
                      <span>CNY</span>
                    </div>
                    <span className="product-sku">{product.sku}</span>
                    <div className="market-product-actions">
                      <Link href={productHref(product.sku)}>{t('View details')}</Link>
                      <button
                        className="button primary"
                        disabled={product.stock <= 0 || adding !== null}
                        onClick={() => void addToCart(product)}
                      >
                        {product.stock <= 0
                          ? t('Sold out')
                          : adding === product.sku
                            ? t('Adding…')
                            : t('+ Add to cart')}
                      </button>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      </div>
      {bottom}
    </div>
  );
}
