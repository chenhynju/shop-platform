'use client';
import { useCallback, useEffect, useState, type FormEvent } from 'react';
import type { ApiResponse, MerchantOrder, ShopProduct } from '@repo/types';
import { useLocale } from '@/components/locale-provider';
import { ShopLogin } from '@/components/shop-login';
import { api } from '@/lib/api';
import { formatCents } from '@/lib/shop';
import { useShopAuth } from '@/lib/use-shop-auth';

export default function MerchantPage() {
  const { st: t, locale } = useLocale();
  const { state: auth, refresh } = useShopAuth('seller');
  const [products, setProducts] = useState<ShopProduct[]>([]);
  const [orders, setOrders] = useState<MerchantOrder[]>([]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const [editing, setEditing] = useState<ShopProduct | null>(null);
  const load = useCallback(async () => {
    const [p, o] = await Promise.all([
      api<ApiResponse<ShopProduct[]>>('/shop/merchant/products'),
      api<ApiResponse<MerchantOrder[]>>('/shop/merchant/orders')
    ]);
    setProducts(p.data);
    setOrders(o.data);
  }, []);
  useEffect(() => {
    if (auth.status === 'authed')
      void load().catch((e) =>
        setError(e instanceof Error ? e.message : 'Unable to load your shop.')
      );
  }, [auth, load]);
  async function action(operation: () => Promise<unknown>) {
    if (busy) return;
    setBusy(true);
    setError('');
    setNotice('');
    try {
      await operation();
      await load();
      setNotice(t('Changes saved.'));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Request failed.');
    } finally {
      setBusy(false);
    }
  }
  function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const body = {
      name: String(data.get('name')),
      description: String(data.get('description')),
      price: Math.round(Number(data.get('price')) * 100),
      status: String(data.get('status'))
    };
    void action(async () => {
      if (editing)
        await api('/shop/merchant/products/' + encodeURIComponent(editing.sku), {
          method: 'PATCH',
          body: JSON.stringify(body)
        });
      else
        await api('/shop/merchant/products', {
          method: 'POST',
          body: JSON.stringify({
            ...body,
            sku: String(data.get('sku')),
            stock: Number(data.get('stock'))
          })
        });
      setEditing(null);
      form.reset();
    });
  }
  if (auth.status === 'checking')
    return <div className="loading-panel">{t('Checking your account…')}</div>;
  if (auth.status === 'guest') return <ShopLogin audience="seller" onSuccess={() => refresh()} />;
  return (
    <>
      <div className="page-heading">
        <div>
          <p className="eyebrow">{t('MERCHANT WORKSPACE')}</p>
          <h1>{t('Your shop')}</h1>
          <p>
            {t(
              'Merchant preview: sample products and internal fulfillment records. No real shipping or settlement is connected.'
            )}
          </p>
          <p className="subtitle">{auth.user.email} · Products, inventory and your order items.</p>
        </div>
        <button
          className="button"
          onClick={async () => {
            await api('/seller/auth/logout', { method: 'POST' });
            setProducts([]);
            setOrders([]);
            await refresh();
          }}
        >
          Sign out
        </button>
      </div>
      {error && (
        <p role="alert" className="message error">
          {error}
        </p>
      )}
      {notice && (
        <p role="status" className="message success">
          {notice}
        </p>
      )}
      <section className="order-card">
        <h2>{editing ? `Edit ${editing.sku}` : 'Create product'}</h2>
        <form key={editing?.sku ?? 'new'} onSubmit={save} className="merchant-form">
          {!editing && (
            <label>
              SKU
              <input name="sku" required pattern="[A-Za-z0-9_-]{2,64}" maxLength={64} />
            </label>
          )}
          <label>
            Name
            <input name="name" defaultValue={editing?.name} required maxLength={120} />
          </label>
          <label>
            Description
            <input name="description" defaultValue={editing?.description} maxLength={2000} />
          </label>
          <label>
            Price (CNY)
            <input
              name="price"
              type="number"
              min="0.01"
              max="1000000"
              step="0.01"
              defaultValue={editing ? editing.price / 100 : undefined}
              required
            />
          </label>
          {!editing && (
            <label>
              Initial stock
              <input
                name="stock"
                type="number"
                min="0"
                max="1000000"
                step="1"
                defaultValue="0"
                required
              />
            </label>
          )}
          <label>
            Status
            <select name="status" defaultValue={editing?.status ?? 'ACTIVE'}>
              <option value="ACTIVE">{t('Active')}</option>
              <option value="OFFLINE">{t('Offline')}</option>
            </select>
          </label>
          <button className="button primary" disabled={busy}>
            {editing ? 'Save product' : 'Create product'}
          </button>
          {editing && (
            <button type="button" className="button" onClick={() => setEditing(null)}>
              Cancel editing
            </button>
          )}
        </form>
      </section>
      <section className="order-card">
        <h2>Your products ({products.length})</h2>
        {!products.length && <p>{t('No products yet. Create your first product above.')}</p>}
        <div className="cart-table-wrap">
          <table className="order-items">
            <thead>
              <tr>
                <th>{t('Product / SKU')}</th>
                <th>{t('Price')}</th>
                <th>{t('Stock')}</th>
                <th>{t('Status')}</th>
                <th>{t('Actions')}</th>
              </tr>
            </thead>
            <tbody>
              {products.map((p) => (
                <tr key={p.id}>
                  <td>
                    {p.name}
                    <br />
                    <small>{p.sku}</small>
                  </td>
                  <td>{formatCents(p.price, locale)}</td>
                  <td>{p.stock}</td>
                  <td>{p.status}</td>
                  <td>
                    <button className="text-button" disabled={busy} onClick={() => setEditing(p)}>
                      Edit
                    </button>
                    <form
                      className="merchant-restock"
                      onSubmit={(e) => {
                        e.preventDefault();
                        const quantity = Number(new FormData(e.currentTarget).get('quantity'));
                        void action(() =>
                          api('/shop/merchant/products/' + encodeURIComponent(p.sku) + '/restock', {
                            method: 'POST',
                            body: JSON.stringify({ quantity })
                          })
                        );
                      }}
                    >
                      <input
                        aria-label={`Stock quantity for ${p.sku}`}
                        name="quantity"
                        type="number"
                        min="1"
                        max="1000000"
                        step="1"
                        defaultValue="1"
                        required
                      />
                      <button className="button" disabled={busy}>
                        Add stock
                      </button>
                    </form>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
      <section>
        <h2>Your orders ({orders.length})</h2>
        {!orders.length && <p>{t('No orders for your products yet.')}</p>}
        {orders.map((o) => (
          <article className="order-card" key={o.orderNo}>
            <div className="order-head">
              <strong>{o.orderNo}</strong>
              <span>{o.status}</span>
            </div>
            <p>
              Your item subtotal: {formatCents(o.subtotal, locale)} (before order-level discounts)
            </p>
            <ul>
              {o.items.map((i) => (
                <li key={i.id}>
                  {i.name} / {i.sku} × {i.quantity} · {i.fulfillmentStatus}
                </li>
              ))}
            </ul>
            {o.status === 'PAID' && o.items.some((i) => i.fulfillmentStatus !== 'FULFILLED') && (
              <button
                className="button primary"
                disabled={busy}
                onClick={() =>
                  action(() =>
                    api('/shop/merchant/orders/' + encodeURIComponent(o.orderNo) + '/fulfill', {
                      method: 'POST'
                    })
                  )
                }
              >
                Mark your items fulfilled
              </button>
            )}
          </article>
        ))}
      </section>
    </>
  );
}
