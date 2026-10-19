'use client';
import { useCallback, useEffect, useState } from 'react';
import type { ApiResponse } from '@repo/types';
import { useShopAuth } from '@/lib/use-shop-auth';
import { ShopLogin } from '@/components/shop-login';
import { useLocale } from '@/components/locale-provider';
import { api } from '@/lib/api';
import { formatCents } from '@/lib/shop';

type Merchant = {
  id: number;
  name: string;
  status: string;
  stores: { id: number; name: string }[];
  members: { role: string; active: boolean; user: { email: string } }[];
  _count: { products: number };
};
type Product = {
  id: number;
  sku: string;
  name: string;
  status: string;
  price: number;
  merchant: { name: string } | null;
  inventory: { stock: number } | null;
};
type Order = {
  orderNo: string;
  status: string;
  total: number;
  createdAt: string;
  items: { sku: string; quantity: number; merchantId: number | null; fulfillmentStatus: string }[];
};
type Audit = { id: number; actorId: number; action: string; target: string; createdAt: string };
type Data = { merchants: Merchant[]; products: Product[]; orders: Order[]; audit: Audit[] };
const tabs = ['Merchants', 'Products', 'Orders', 'Audit trail'] as const;
export default function AdminPage() {
  const { state: auth, refresh } = useShopAuth('admin');
  const { st: t, locale } = useLocale();
  const [tab, setTab] = useState<(typeof tabs)[number]>('Merchants');
  const [data, setData] = useState<Data | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const load = useCallback(async () => {
    setBusy(true);
    setError('');
    try {
      const [merchants, products, orders, audit] = await Promise.all(
        ['merchants', 'products', 'orders', 'audit'].map((path) =>
          api<ApiResponse<unknown[]>>('/admin/' + path)
        )
      );
      setData({
        merchants: merchants!.data,
        products: products!.data,
        orders: orders!.data,
        audit: audit!.data
      } as Data);
    } catch (e) {
      setError(e instanceof Error ? e.message : t('Unable to load data.'));
    } finally {
      setBusy(false);
    }
  }, [t]);
  useEffect(() => {
    if (auth.status === 'authed') void load();
  }, [auth, load]);
  if (auth.status === 'checking') return <p>{t('Checking your account…')}</p>;
  if (auth.status === 'guest') return <ShopLogin audience="admin" onSuccess={() => refresh()} />;
  return (
    <>
      <div className="page-heading">
        <div>
          <p className="eyebrow">PURELAMP OPERATIONS</p>
          <h1>{t('Platform administration')}</h1>
          <p>{auth.user.email}</p>
        </div>
        <button
          className="button"
          onClick={async () => {
            await api('/admin/auth/logout', { method: 'POST' });
            setData(null);
            await refresh();
          }}
        >
          {t('Sign out')}
        </button>
      </div>
      <p className="message">
        {t(
          'Operations preview: read-only platform oversight. Live payments and logistics are not connected. Sensitive administration requires MFA and is not enabled.'
        )}
      </p>
      {error && <p role="alert">{error}</p>}
      <div className="page-heading">
        <nav aria-label={t('Platform sections')}>
          {tabs.map((name) => (
            <button
              className={tab === name ? 'button primary' : 'button'}
              key={name}
              onClick={() => setTab(name)}
            >
              {t(name)}
            </button>
          ))}
        </nav>
        <button className="button" disabled={busy} onClick={() => void load()}>
          {busy ? t('Please wait…') : t('Refresh')}
        </button>
      </div>
      {data && (
        <p>
          {t('Merchants')}: {data.merchants.length} · {t('Products')}: {data.products.length} ·{' '}
          {t('Orders')}: {data.orders.length} · {t('Audit trail')}: {data.audit.length} (
          {t('Latest 100 records per section')})
        </p>
      )}
      {data && (
        <section className="order-card">
          <h2>{t(tab)}</h2>
          <div className="cart-table-wrap">
            <table className="order-items">
              <thead>
                <tr>
                  {(tab === 'Merchants'
                    ? ['Merchant / store', 'Status', 'Members', 'Products']
                    : tab === 'Products'
                      ? ['Product / SKU', 'Merchant / store', 'Status', 'Stock', 'Price (CNY)']
                      : tab === 'Orders'
                        ? ['Order', 'Status', 'Total (CNY)', 'Items']
                        : ['Date', 'Actor', 'Action', 'Target']
                  ).map((label) => (
                    <th key={label}>{t(label)}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {tab === 'Merchants' &&
                  data.merchants.map((m) => (
                    <tr key={m.id}>
                      <td>
                        {m.name}
                        <br />
                        {m.stores.map((s) => s.name).join(', ')}
                      </td>
                      <td>{m.status}</td>
                      <td>
                        {m.members
                          .map((u) => `${u.user.email} · ${u.role}${u.active ? '' : ' (inactive)'}`)
                          .join(', ')}
                      </td>
                      <td>{m._count.products}</td>
                    </tr>
                  ))}
                {tab === 'Products' &&
                  data.products.map((p) => (
                    <tr key={p.id}>
                      <td>
                        {p.name}
                        <br />
                        {p.sku}
                      </td>
                      <td>{p.merchant?.name ?? t('Legacy platform catalog')}</td>
                      <td>{p.status}</td>
                      <td>{p.inventory?.stock ?? 0}</td>
                      <td>{formatCents(p.price, locale)}</td>
                    </tr>
                  ))}
                {tab === 'Orders' &&
                  data.orders.map((o) => (
                    <tr key={o.orderNo}>
                      <td>{o.orderNo}</td>
                      <td>{o.status}</td>
                      <td>{formatCents(o.total, locale)}</td>
                      <td>
                        {o.items
                          .map((i) => `${i.sku} × ${i.quantity} · ${i.fulfillmentStatus}`)
                          .join(', ')}
                      </td>
                    </tr>
                  ))}
                {tab === 'Audit trail' &&
                  data.audit.map((a) => (
                    <tr key={a.id}>
                      <td>{new Date(a.createdAt).toLocaleString(locale)}</td>
                      <td>{a.actorId}</td>
                      <td>{a.action}</td>
                      <td>{a.target}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
          {(tab === 'Merchants'
            ? data.merchants
            : tab === 'Products'
              ? data.products
              : tab === 'Orders'
                ? data.orders
                : data.audit
          ).length === 0 && <p>{t('No records yet.')}</p>}
        </section>
      )}
    </>
  );
}
