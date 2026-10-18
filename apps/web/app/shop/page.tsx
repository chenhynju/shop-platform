'use client';
import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ProductArt } from '@/components/product-art';
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
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState('featured');
  const [inStock, setInStock] = useState(false);
  const visibleProducts = useMemo(() => {
    const query = search.trim().toLowerCase();
    const result = products.filter(
      (p) =>
        (!inStock || p.stock > 0) &&
        `${p.name} ${p.description} ${p.sku}`.toLowerCase().includes(query)
    );
    if (sort === 'price-low') result.sort((a, b) => a.price - b.price);
    if (sort === 'price-high') result.sort((a, b) => b.price - a.price);
    if (sort === 'name') result.sort((a, b) => a.name.localeCompare(b.name));
    return result;
  }, [products, search, sort, inStock]);

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
      <p className="store-preview">
        PREVIEW STORE <span>Explore sample products. Payments are simulated.</span>
      </p>
      <section className="store-hero" aria-labelledby="store-title">
        <div className="store-hero-copy">
          <p className="eyebrow">A LITTLE EVERYDAY INSPIRATION</p>
          <h1 id="store-title">
            Good finds.
            <br />
            Better everyday.
          </h1>
          <p>A fresh perspective on the things you use every day. Explore our first collection.</p>
          <a className="store-cta" href="#catalog">
            Explore the collection <span aria-hidden="true">↗</span>
          </a>
          <span className="hero-edition">THE FIRST EDIT / 01</span>
        </div>
        <div className="store-hero-art">
          <span className="art-orbit" />
          <ProductArt name="headphones" large />
          <span className="hero-art-label">
            EVERYDAY ESSENTIALS
            <br />
            <strong>A new point of view.</strong>
          </span>
        </div>
      </section>
      <section className="store-values" aria-label="Shopping information">
        <div>
          <span>01</span>
          <strong>Browse at your pace</strong>
          <p>Explore the collection before signing in.</p>
        </div>
        <div>
          <span>02</span>
          <strong>Make it your own</strong>
          <p>Save items to your personal cart.</p>
        </div>
        <div>
          <span>03</span>
          <strong>Keep it all together</strong>
          <p>Find your purchases in your account.</p>
        </div>
      </section>
      <div id="catalog" className="catalog-heading">
        <div>
          <p className="eyebrow">THE COLLECTION</p>
          <h2>Find your next favorite.</h2>
        </div>
        <span>{loading ? 'Loading collection…' : `${visibleProducts.length} products`}</span>
      </div>
      <div className="catalog-tools">
        <label className="catalog-search">
          <span className="sr-only">Search products</span>
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search products, names or SKU…"
          />
        </label>
        <label className="catalog-stock">
          <input type="checkbox" checked={inStock} onChange={(e) => setInStock(e.target.checked)} />{' '}
          In stock only
        </label>
        <label>
          <span className="sr-only">Sort products</span>
          <select aria-label="Sort products" value={sort} onChange={(e) => setSort(e.target.value)}>
            <option value="featured">Featured</option>
            <option value="price-low">Price: low to high</option>
            <option value="price-high">Price: high to low</option>
            <option value="name">Name: A–Z</option>
          </select>
        </label>
      </div>
      {auth.status === 'guest' && (
        <p className="shop-guest-bar">
          Found something you like? <Link href="/account">Sign in or create an account</Link> to use
          the cart and place orders.
        </p>
      )}
      {Boolean(error) && (
        <div role="alert" className="message error">
          <strong>We couldn’t finish that request.</strong>
          <span>{localizeError(error, locale)}</span>
          <button className="text-button" onClick={() => setError(null)}>
            Dismiss
          </button>
          <button className="text-button" onClick={() => void loadProducts()}>
            Retry loading products
          </button>
        </div>
      )}
      <div role="status" aria-live="polite" className={notice ? 'message success' : 'sr-only'}>
        {notice || null}
      </div>
      {loading ? (
        <div className="loading-panel">Loading products…</div>
      ) : visibleProducts.length === 0 ? (
        <div className="shop-empty">
          <strong>
            {products.length
              ? 'No matching products'
              : error
                ? 'Collection unavailable'
                : 'Our collection is coming together'}
          </strong>
          <p>
            {products.length
              ? 'Try another search or clear the stock filter.'
              : 'Please check back soon or refresh the collection.'}
          </p>
          <button
            className="button secondary"
            onClick={() => {
              setSearch('');
              setInStock(false);
              void loadProducts();
            }}
          >
            {products.length ? 'Clear filters' : 'Refresh'}
          </button>
        </div>
      ) : (
        <div className="product-grid">
          {visibleProducts.map((product) => {
            const soldOut = product.stock <= 0;
            const busy = adding === product.sku;
            return (
              <article className="product-card" key={product.sku}>
                <div className="product-image">
                  <ProductArt name={product.name} />
                  <span>Illustration</span>
                </div>
                <span className="product-sku">{product.sku}</span>
                <h3>{product.name}</h3>
                <p>{product.description || 'Explore this sample from our preview collection.'}</p>
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
      <p className="catalog-note">
        Sample catalog prices are shown in CNY (¥). USD and CAD checkout will be enabled after
        market pricing is configured.
      </p>
    </>
  );
}
