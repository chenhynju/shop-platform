'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { formatDate } from '@toolkit/i18n';
import { useLocale } from '@/components/locale-provider';
import { ShopLogin } from '@/components/shop-login';
import { api } from '@/lib/api';
import { localizeShopError } from '@/lib/shop-error';
import { formatCents } from '@/lib/shop';
import { useShopAuth } from '@/lib/use-shop-auth';
import type { ApiResponse, OrderView } from '@repo/types';

export default function OrdersPage() {
  const { st: t, sample, locale } = useLocale();
  const { state: auth, refresh } = useShopAuth();
  const [orders, setOrders] = useState<OrderView[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [notice, setNotice] = useState('');
  const [busyOrder, setBusyOrder] = useState<string | null>(null);

  const loadOrders = useCallback(async () => {
    setLoading(true);
    try {
      const result = await api<ApiResponse<OrderView[]>>('/shop/orders');
      setOrders(result.data);
      setError(null);
    } catch (err) {
      setError(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (auth.status === 'authed') void loadOrders();
  }, [auth.status, loadOrders]);

  useEffect(() => {
    if (new URLSearchParams(window.location.search).has('placed')) {
      setNotice(t('Order placed successfully. Pay now or cancel it below.'));
    }
  }, [t]);

  async function payOrder(order: OrderView) {
    if (busyOrder !== null) return;
    setBusyOrder(order.orderNo);
    setError(null);
    try {
      await api('/shop/payments/' + order.orderNo + '/mock-pay', { method: 'POST' });
      await loadOrders();
    } catch (err) {
      setError(err);
    } finally {
      setBusyOrder(null);
    }
  }

  async function cancelOrder(order: OrderView) {
    if (
      !window.confirm(
        t('Cancel order {orderNo}? Reserved stock is returned.', { orderNo: order.orderNo })
      )
    )
      return;
    if (busyOrder !== null) return;
    setBusyOrder(order.orderNo);
    setError(null);
    try {
      await api('/shop/orders/' + order.orderNo + '/cancel', { method: 'POST' });
      await loadOrders();
    } catch (err) {
      setError(err);
    } finally {
      setBusyOrder(null);
    }
  }

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
          <p className="market-kicker">{t('YOUR ACCOUNT / PURCHASES')}</p>
          <h1>{t('Your orders')}</h1>
          <p className="subtitle">
            {t(
              'Newest first. Pay pending orders with the mock gateway or cancel them to return stock.'
            )}{' '}
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
      {loading && orders.length === 0 ? (
        <div className="loading-panel">{t('Loading your orders…')}</div>
      ) : orders.length === 0 ? (
        <div className="shop-empty">
          <strong>{t('No orders yet')}</strong>
          <p>{t('When you place an order it will show up here with payment actions.')}</p>
          <Link href="/shop" className="button primary">
            {t('← Browse products')}{' '}
          </Link>
        </div>
      ) : (
        orders.map((order) => (
          <article className="order-card" key={order.id}>
            <div className="order-head">
              <div>
                <strong className="order-no">{order.orderNo}</strong>
                <span className="order-date">
                  {formatDate(order.createdAt, locale, {
                    year: 'numeric',
                    month: 'short',
                    day: 'numeric',
                    hour: 'numeric',
                    minute: '2-digit'
                  })}
                </span>
              </div>
              <span className={'order-status ' + order.status.toLowerCase()}>
                {t(order.status)}
              </span>
            </div>
            <div className="cart-table-wrap">
              <table className="order-items">
                <thead>
                  <tr>
                    <th>{t('Item')}</th>
                    <th>{t('Unit price')}</th>
                    <th>{t('Qty')}</th>
                    <th className="align-right">{t('Line total')}</th>
                  </tr>
                </thead>
                <tbody>
                  {order.items.map((item) => (
                    <tr key={`${item.sku}-${item.price}-${item.quantity}`}>
                      <td>
                        {sample(item.sku, 'name', item.name)}{' '}
                        <span className="order-item-sku">{item.sku}</span>
                      </td>
                      <td>{formatCents(item.price, locale)}</td>
                      <td>{item.quantity}</td>
                      <td className="align-right">
                        {formatCents(item.price * item.quantity, locale)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="order-foot">
              <div className="order-total">
                {t('Total')} <strong>{formatCents(order.total, locale)}</strong>
              </div>
              {order.status === 'PENDING' && (
                <div className="order-actions">
                  <button
                    className="button primary"
                    disabled={busyOrder === order.orderNo}
                    onClick={() => void payOrder(order)}
                  >
                    {busyOrder === order.orderNo ? t('Working…') : t('Pay now (mock)')}
                  </button>
                  <button
                    className="button secondary"
                    disabled={busyOrder === order.orderNo}
                    onClick={() => void cancelOrder(order)}
                  >
                    {t('Cancel')}{' '}
                  </button>
                </div>
              )}
            </div>
          </article>
        ))
      )}
    </>
  );
}
