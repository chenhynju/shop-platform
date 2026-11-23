'use client';
import { useLocale } from '@/components/locale-provider';

import Link from 'next/link';
import { useState } from 'react';
import { ShopLogin } from '@/components/shop-login';
import { useShopAuth } from '@/lib/use-shop-auth';
import { api } from '@/lib/api';
import { CART_CHANGED_EVENT } from '@/lib/shop';

export default function ShopAccount() {
  const { st: t } = useLocale();
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
        <p role="status">{t('Loading your account…')}</p>
      ) : state.status === 'guest' ? (
        <ShopLogin
          onSuccess={() => {
            void refresh();
          }}
        />
      ) : (
        <section className="shop-login-card">
          <p className="eyebrow">{t('YOUR ACCOUNT')}</p>
          <h1>
            {t('Welcome,')} {state.user.name || 'shopper'}
          </h1>
          <p>{state.user.email}</p>
          <p>
            <Link className="button primary" href="/shop/orders">
              {t('View your orders')}{' '}
            </Link>
          </p>
          <p>
            <Link href="/shop/cart">{t('Continue to your cart →')}</Link>
          </p>
          {state.user.role === 'ADMIN' && (
            <p>
              <Link href="/workspace">{t('Administration workspace →')}</Link>
            </p>
          )}
          {error && <p role="alert">{t('Could not sign out. Please try again.')}</p>}
          <button className="button secondary" disabled={busy} onClick={() => void logout()}>
            {busy ? t('Signing out…') : t('Sign out')}
          </button>
        </section>
      )}
    </>
  );
}
