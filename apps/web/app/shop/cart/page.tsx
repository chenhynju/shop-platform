'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { useLocale } from '@/components/locale-provider';
import { ShopLogin } from '@/components/shop-login';
import { ProductMedia } from '@/components/product-media';
import { productHref } from '@/lib/catalog';
import { api, RequestError } from '@/lib/api';
import { localizeShopError } from '@/lib/shop-error';
import { CART_CHANGED_EVENT, describePromotion, estimatePromoTotal, formatCents } from '@/lib/shop';
import { useShopAuth } from '@/lib/use-shop-auth';
import type {
  ApiResponse,
  CartItem,
  CreateOrderRequest,
  OrderView,
  PromotionInfo,
  ShopProduct
} from '@repo/types';

export default function CartPage() {
  const { st: t, sample, locale } = useLocale();
  const router = useRouter();
  const { state: auth, refresh } = useShopAuth();
  const [cart, setCart] = useState<CartItem[]>([]);
  const [products, setProducts] = useState<ShopProduct[]>([]);
  const [promotions, setPromotions] = useState<PromotionInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [notice, setNotice] = useState('');
  const [busySku, setBusySku] = useState<string | null>(null);
  const [placing, setPlacing] = useState(false);
  const [promoInput, setPromoInput] = useState('');

  const loadCart = useCallback(async () => {
    setLoading(true);
    try {
      const [cartResult, productResult, promoResult] = await Promise.all([
        api<ApiResponse<CartItem[]>>('/shop/cart'),
        api<ApiResponse<ShopProduct[]>>('/shop/products'),
        api<ApiResponse<PromotionInfo[]>>('/shop/promotions')
      ]);
      setCart(cartResult.data);
      setProducts(productResult.data);
      setPromotions(promoResult.data);
      setError(null);
    } catch (err) {
      setError(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (auth.status === 'authed') void loadCart();
  }, [auth.status, loadCart]);

  async function changeQuantity(sku: string, quantity: number) {
    if (busySku !== null) return;
    setBusySku(sku);
    setError(null);
    try {
      await api('/shop/cart/' + encodeURIComponent(sku), {
        method: 'PUT',
        body: JSON.stringify({ quantity })
      });
      window.dispatchEvent(new Event(CART_CHANGED_EVENT));
      await loadCart();
    } catch (err) {
      setError(err);
    } finally {
      setBusySku(null);
    }
  }

  async function placeOrder() {
    if (cart.length === 0 || placing) return;
    setPlacing(true);
    setError(null);
    setNotice('');
    const promoCode = promoInput.trim();
    const payload: CreateOrderRequest = {
      items: cart.map((item) => ({ sku: item.sku, quantity: item.quantity })),
      ...(promoCode ? { promoCode } : {})
    };
    try {
      await api<ApiResponse<OrderView>>('/shop/orders', {
        method: 'POST',
        body: JSON.stringify(payload)
      });
      window.dispatchEvent(new Event(CART_CHANGED_EVENT));
      router.push('/shop/orders?placed=1');
    } catch (err) {
      setPlacing(false);
      setError(err);
      if (err instanceof RequestError && err.code === 'NO_STOCK') {
        setNotice(t('Some items ran out of stock. Review your cart below.'));
        await loadCart();
      }
    }
  }

  const productBySku = new Map(products.map((product) => [product.sku, product]));
  const rows = cart
    .map((item) => ({ item, product: productBySku.get(item.sku) }))
    .filter(
      (row): row is { item: CartItem; product: ShopProduct } =>
        row.product !== null && row.product !== undefined
    );
  const subtotal = rows.reduce((sum, row) => sum + row.product.price * row.item.quantity, 0);
  const promoCode = promoInput.trim();
  const appliedPromo =
    promoCode === '' ? null : (promotions.find((promo) => promo.code === promoCode) ?? null);
  const estimatedTotal = estimatePromoTotal(subtotal, appliedPromo);
  const discount = subtotal - estimatedTotal;

  if (auth.status === 'checking') {
    return <div className="loading-panel">{t('Checking your account…')}</div>;
  }
  if (auth.status === 'guest') {
    return <ShopLogin onSuccess={() => refresh()} />;
  }

  return (
    <>
      <div className="page-heading">
        <div>
          <p className="market-kicker">{t('YOUR SHOPPING BAG')}</p>
          <h1>{t('Your cart')}</h1>
          <p className="subtitle">
            {t('Quantities update instantly. Stock is reserved when you place the order.')}{' '}
          </p>
        </div>
        <Link className="market-back" href="/shop">
          {t('Continue shopping →')}{' '}
        </Link>
      </div>
      {Boolean(error) && (
        <div role="alert" className="message error">
          <strong>{t('We couldn’t finish that request.')}</strong>
          <span>{localizeShopError(error, t)}</span>
          <button className="text-button" onClick={() => setError(null)}>
            {t('Dismiss')}{' '}
          </button>
        </div>
      )}
      <div role="status" aria-live="polite" className={notice ? 'message success' : 'sr-only'}>
        {notice || null}
      </div>
      {loading && cart.length === 0 ? (
        <div className="loading-panel">{t('Loading your cart…')}</div>
      ) : cart.length === 0 ? (
        <div className="shop-empty">
          <strong>{t('Your cart is empty')}</strong>
          <p>{t('Browse the catalog and add something you like.')}</p>
          <Link href="/shop" className="button primary">
            {t('← Back to products')}{' '}
          </Link>
        </div>
      ) : (
        <div className="cart-layout">
          <section className="shop-panel" aria-label={t('Cart items')}>
            <div className="cart-table-wrap">
              <table className="cart-table">
                <thead>
                  <tr>
                    <th>{t('Product')}</th>
                    <th>{t('Price')}</th>
                    <th>{t('Quantity')}</th>
                    <th className="align-right">{t('Subtotal')}</th>
                    <th>
                      <span className="sr-only">{t('Remove')}</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => {
                    const busy = busySku === row.item.sku;
                    return (
                      <tr key={row.item.sku}>
                        <td className="cart-product">
                          <Link
                            className="market-cart-image"
                            href={productHref(row.item.sku)}
                            aria-label={t('View {name}', {
                              name: sample(row.item.sku, 'name', row.product.name)
                            })}
                          >
                            <ProductMedia
                              label={sample(row.item.sku, 'name', row.product.name)}
                              name={row.product.name}
                            />
                          </Link>
                          <strong>
                            <Link href={productHref(row.item.sku)}>
                              {sample(row.item.sku, 'name', row.product.name)}
                            </Link>
                          </strong>
                          <span className="product-sku">{row.item.sku}</span>
                        </td>
                        <td>{formatCents(row.product.price, locale)}</td>
                        <td>
                          <div className="stepper">
                            <button
                              type="button"
                              aria-label={t('Decrease {name}', {
                                name: sample(row.item.sku, 'name', row.product.name)
                              })}
                              disabled={busy || row.item.quantity <= 1}
                              onClick={() => changeQuantity(row.item.sku, row.item.quantity - 1)}
                            >
                              −
                            </button>
                            <span aria-live="polite">{row.item.quantity}</span>
                            <button
                              type="button"
                              aria-label={t('Increase {name}', {
                                name: sample(row.item.sku, 'name', row.product.name)
                              })}
                              disabled={busy}
                              onClick={() => changeQuantity(row.item.sku, row.item.quantity + 1)}
                            >
                              +
                            </button>
                          </div>
                        </td>
                        <td className="align-right">
                          {formatCents(row.product.price * row.item.quantity, locale)}
                        </td>
                        <td className="align-right">
                          <button
                            className="text-button danger"
                            disabled={busy}
                            onClick={() => changeQuantity(row.item.sku, 0)}
                          >
                            {t('Remove')}{' '}
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>
          <aside className="shop-panel cart-summary" aria-label={t('Order summary')}>
            <h2>{t('Order summary')}</h2>
            <div className="summary-row">
              <span>{t('Subtotal')}</span>
              <span>{formatCents(subtotal, locale)}</span>
            </div>
            {appliedPromo && (
              <div className="summary-row">
                <span>
                  {t('Promo')} {appliedPromo.code}
                  {t('(estimate)')}
                </span>
                <span>−{formatCents(discount, locale)}</span>
              </div>
            )}
            <div className="summary-row total">
              <span>{appliedPromo ? t('Estimated total') : t('Total')}</span>
              <span>{formatCents(estimatedTotal, locale)}</span>
            </div>
            <label>
              {t('Promo code')}{' '}
              <input
                name="promoCode"
                value={promoInput}
                onChange={(event) => setPromoInput(event.target.value)}
                placeholder={t('e.g. SAVE10')}
                autoComplete="off"
              />
            </label>
            {promoCode !== '' && appliedPromo === null && (
              <p className="promo-state bad">
                {t('Unknown code — the server will ignore it. Check the list below.')}{' '}
              </p>
            )}
            {appliedPromo && (
              <p className="promo-state ok">
                {appliedPromo.code}
                {t('applied · saves')} {formatCents(discount, locale)}
                {t('at most.')}{' '}
              </p>
            )}
            {promotions.length > 0 && (
              <p className="promo-hints">
                {t('Available:')}{' '}
                {promotions
                  .map((promo) => `${promo.code} — ${describePromotion(promo, locale, t)}`)
                  .join(' · ')}
              </p>
            )}
            <button
              className="button primary full-width"
              disabled={placing || cart.length === 0}
              onClick={() => void placeOrder()}
            >
              {placing ? t('Placing order…') : t('Place order')} <span aria-hidden="true">↗</span>
            </button>
            <p className="summary-note">
              {t(
                'The final discount is applied by the server when the order is created. Unpaid orders can be cancelled from your orders page.'
              )}{' '}
            </p>
          </aside>
        </div>
      )}
    </>
  );
}
