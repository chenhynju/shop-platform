'use client';
import Link from 'next/link';
import { useState } from 'react';
import { ShopLogin } from '@/components/shop-login';
import { useShopAuth } from '@/lib/use-shop-auth';
import { api } from '@/lib/api';
import { CART_CHANGED_EVENT } from '@/lib/shop';

export default function ShopAccount() {
  const { state, refresh } = useShopAuth();
  const [error, setError] = useState(false);
  const [busy, setBusy] = useState(false);
  async function logout() {
    setBusy(true);
    setError(false);
    try {
      await api('/auth/logout', { method: 'POST' });
      await refresh();
      window.dispatchEvent(new Event(CART_CHANGED_EVENT));
    } catch {
      setError(true);
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      {state.status === 'checking' ? (
        <p role="status">Loading your account…</p>
      ) : state.status === 'guest' ? (
        <ShopLogin
          onSuccess={() => {
            void refresh();
          }}
        />
      ) : (
        <section className="shop-login-card">
          <p className="eyebrow">YOUR ACCOUNT</p>
          <h1>Welcome, {state.user.name || 'shopper'}</h1>
          <p>{state.user.email}</p>
          <p>
            <Link className="button primary" href="/shop/orders">
              View your orders
            </Link>
          </p>
          <p>
            <Link href="/shop/cart">Continue to your cart →</Link>
          </p>
          {state.user.role === 'ADMIN' && (
            <p>
              <Link href="/workspace">Administration workspace →</Link>
            </p>
          )}
          {error && <p role="alert">Could not sign out. Please try again.</p>}
          <button className="button secondary" disabled={busy} onClick={() => void logout()}>
            {busy ? 'Signing out…' : 'Sign out'}
          </button>
        </section>
      )}
    </>
  );
}
