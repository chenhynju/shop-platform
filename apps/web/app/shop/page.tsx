'use client';
import Link from 'next/link';
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

export default function ShopPage() {
  const { locale } = useLocale();
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
        `${p.name} ${p.description} ${p.sku}`.toLowerCase().includes(query.toLowerCase())
    );
    if (sort === 'price-low') result.sort((a, b) => a.price - b.price);
    if (sort === 'price-high') result.sort((a, b) => b.price - a.price);
    if (sort === 'name') result.sort((a, b) => a.name.localeCompare(b.name));
    return result;
  }, [products, query, category, sort, inStock]);
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
  }
  const filtered = query || category !== 'all' || inStock;
  return (
    <div className="market-home">
      {!filtered && (
        <>
          <section className="market-hero-grid" aria-label="Discover the collection">
            <div className="market-hero">
              <div className="market-hero-copy">
                <span className="market-kicker">THE EVERYDAY EDIT</span>
                <h1>
                  Your everyday,
                  <br />
                  upgraded.
                </h1>
                <p>
                  A better desk. A slower coffee.
                  <br />
                  Find the little things that make a difference.
                </p>
                <Link className="market-button" href="/shop?category=tech">
                  Explore tech & accessories <span aria-hidden="true">→</span>
                </Link>
              </div>
              <ProductMedia name="Desk collection" scene priority />
              <span className="market-image-label">AI-generated sample imagery</span>
            </div>
            <div className="market-mini-promos">
              <Link href="/shop?category=home" className="market-mini home">
                <div>
                  <span className="market-kicker">HOME & LIVING</span>
                  <h2>
                    A little more
                    <br />
                    feel-good.
                  </h2>
                  <span>Explore the collection →</span>
                </div>
                <ProductMedia name="Ceramic mug" priority />
              </Link>
              <Link href="/shop?category=desk" className="market-mini desk">
                <div>
                  <span className="market-kicker">DESK ESSENTIALS</span>
                  <h2>
                    Make space
                    <br />
                    for focus.
                  </h2>
                  <span>Find your desk essentials →</span>
                </div>
                <ProductMedia name="Desk mat" priority />
              </Link>
            </div>
          </section>
          <section className="market-category-tiles" aria-label="Shop by category">
            {categories.map((c) => (
              <Link key={c.id} href={c.id === 'all' ? '/shop' : '/shop?category=' + c.id}>
                <span className="category-symbol" aria-hidden="true">
                  {c.icon}
                </span>
                <div>
                  <strong>{c.label}</strong>
                  <span>
                    {loading
                      ? 'Explore the collection'
                      : `${products.filter((p) => c.id === 'all' || categoryOf(p) === c.id).length} sample products`}
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
          <p className="market-kicker">FIND SOMETHING YOU’LL LOVE</p>
          {filtered ? (
            <h1>
              {query
                ? `Results for “${query}”`
                : (categories.find((c) => c.id === category)?.label ?? 'Products in stock')}
            </h1>
          ) : (
            <h2>Explore the marketplace</h2>
          )}
        </div>
        <span>{loading ? 'Loading…' : `${visibleProducts.length} products`}</span>
      </div>
      <div className="market-catalog-layout">
        <aside className="market-filters" aria-label="Product filters">
          <h2>Categories</h2>
          {categories.map((c) => (
            <Link
              key={c.id}
              className={category === c.id ? 'selected' : ''}
              href={c.id === 'all' ? '/shop' : '/shop?category=' + c.id}
            >
              {c.label}
              <span>{products.filter((p) => c.id === 'all' || categoryOf(p) === c.id).length}</span>
            </Link>
          ))}
          <div className="market-filter-divider" />
          <h2>Availability</h2>
          <label className="catalog-stock">
            <input
              type="checkbox"
              checked={stockChecked}
              onChange={(e) => {
                setStockChecked(e.target.checked);
                filter('stock', e.target.checked ? 'available' : '');
              }}
            />{' '}
            In stock only
          </label>
          <div className="market-filter-info">
            <strong>A first look at Purelamp</strong>
            <p>Sample products, real shopping flows. Payments are simulated.</p>
            <Link href="/shop/guide">How this preview works →</Link>
          </div>
        </aside>
        <section className="market-results" aria-label="Product results">
          <div className="market-results-toolbar">
            <div className="market-filter-pills">
              <span>{categories.find((c) => c.id === category)?.label ?? 'All products'}</span>
              {filtered && <Link href="/shop">Clear filters ×</Link>}
            </div>
            <label>
              Sort by{' '}
              <select
                aria-label="Sort products"
                value={sort}
                onChange={(e) => filter('sort', e.target.value)}
              >
                <option value="featured">Featured</option>
                <option value="price-low">Price: low to high</option>
                <option value="price-high">Price: high to low</option>
                <option value="name">Name: A–Z</option>
              </select>
            </label>
          </div>
          {Boolean(error) && (
            <div role="alert" className="message error">
              <strong>We couldn’t finish that request.</strong>
              <span>{localizeError(error, locale)}</span>
              <button className="text-button" onClick={() => void loadProducts()}>
                Retry loading products
              </button>
            </div>
          )}
          <div role="status" aria-live="polite" className={notice ? 'message success' : 'sr-only'}>
            {notice || null}
            {notice.includes('Please sign in') && <Link href="/account"> Sign in →</Link>}
          </div>
          {loading ? (
            <div className="market-loading" role="status">
              Loading the collection…
            </div>
          ) : visibleProducts.length === 0 ? (
            <div className="shop-empty">
              <strong>
                {products.length
                  ? 'No matching products'
                  : error
                    ? 'Collection unavailable'
                    : 'The collection is coming soon'}
              </strong>
              <p>Try another search or browse all products.</p>
              <button
                className="button secondary"
                onClick={() => {
                  router.push('/shop');
                  void loadProducts();
                }}
              >
                Clear filters
              </button>
            </div>
          ) : (
            <div className="product-grid">
              {visibleProducts.map((product) => (
                <article className="product-card" key={product.sku}>
                  <Link
                    className="product-image"
                    href={productHref(product.sku)}
                    aria-label={`View ${product.name}`}
                  >
                    <ProductMedia name={product.name} />
                    <span
                      className={'market-stock-tag' + (product.stock <= 0 ? ' unavailable' : '')}
                    >
                      {product.stock > 0 ? 'In stock' : 'Sold out'}
                    </span>
                  </Link>
                  <div className="market-product-body">
                    <span className="market-product-category">
                      {categories.find((c) => c.id === categoryOf(product))?.label}
                    </span>
                    <h3>
                      <Link href={productHref(product.sku)}>{product.name}</Link>
                    </h3>
                    <p>
                      {product.description || 'Discover this sample from our first collection.'}
                    </p>
                    <div className="market-price-line">
                      <strong className="product-price">{formatCents(product.price)}</strong>
                      <span>CNY</span>
                    </div>
                    <span className="product-sku">{product.sku}</span>
                    <div className="market-product-actions">
                      <Link href={productHref(product.sku)}>View details</Link>
                      <button
                        className="button primary"
                        disabled={product.stock <= 0 || adding !== null}
                        onClick={() => void addToCart(product)}
                      >
                        {product.stock <= 0
                          ? 'Sold out'
                          : adding === product.sku
                            ? 'Adding…'
                            : '+ Add to cart'}
                      </button>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      </div>
      <section className="market-bottom-banner">
        <div>
          <span className="market-kicker">YOUR NEXT FIND IS WAITING</span>
          <h2>A place for your everyday favorites.</h2>
          <p>Create an account to keep your cart and orders together.</p>
        </div>
        <Link href="/account" className="market-button">
          Your Purelamp account →
        </Link>
      </section>
      <p className="catalog-note">
        Preview catalog · Prices in CNY (¥) · AI-generated sample images · Simulated payments.
        Delivery, returns and USD/CAD checkout are not yet available.
      </p>
    </div>
  );
}
