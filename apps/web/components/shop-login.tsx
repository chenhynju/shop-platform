'use client';

import Link from 'next/link';
import { useState, type FormEvent } from 'react';
import { useLocale } from '@/components/locale-provider';
import { api } from '@/lib/api';
import { localizeShopError } from '@/lib/shop-error';
import { CART_CHANGED_EVENT } from '@/lib/shop';
import type { ApiResponse, User } from '@repo/types';

export function ShopLogin({
  onSuccess,
  audience
}: {
  onSuccess: (user: User) => void;
  audience?: 'seller' | 'admin';
}) {
  const { st: t } = useLocale();
  const [busy, setBusy] = useState(false);
  const [register, setRegister] = useState(false);
  const [error, setError] = useState<unknown>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    const data = new FormData(event.currentTarget);
    try {
      const result = await api<ApiResponse<User>>(
        audience ? `/${audience}/auth/login` : register ? '/auth/register' : '/auth/login',
        {
          method: 'POST',
          body: JSON.stringify({
            ...(register ? { name: String(data.get('name')) } : {}),
            email: String(data.get('email')),
            password: String(data.get('password'))
          })
        }
      );
      window.dispatchEvent(new Event(CART_CHANGED_EVENT));
      onSuccess(result.data);
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="shop-login-card">
      <span className="eyebrow">
        {audience === 'seller'
          ? t('Merchant center')
          : audience === 'admin'
            ? t('Platform administration')
            : t('YOUR PURELAMP ACCOUNT')}
      </span>
      <h1>{register ? t('Create your account') : t('Sign in to continue')}</h1>
      <p>{t('Keep your cart and orders together. This preview store uses simulated payments.')}</p>
      {Boolean(error) && (
        <p role="alert" className="form-error">
          {localizeShopError(error, t)}
        </p>
      )}
      <form onSubmit={submit}>
        {register && (
          <label>
            {t('Your name')} <input name="name" required maxLength={80} autoComplete="name" />
          </label>
        )}
        <label>
          {t('Email address')}{' '}
          <input
            name="email"
            type="email"
            autoComplete="email"
            required
            maxLength={254}
            placeholder="you@example.com"
            autoFocus
          />
        </label>
        <label>
          {t('Password')}{' '}
          <input
            name="password"
            type="password"
            autoComplete={register ? 'new-password' : 'current-password'}
            required
            minLength={12}
            maxLength={128}
            placeholder={t('At least 12 characters')}
          />
        </label>
        <button className="button primary full-width" disabled={busy}>
          {busy ? t('Please wait…') : register ? t('Create account') : t('Sign in')}{' '}
          <span aria-hidden="true">↗</span>
        </button>
      </form>
      <p className="shop-login-footnote">
        {!audience && (
          <button
            type="button"
            className="text-button"
            disabled={busy}
            onClick={() => {
              setRegister(!register);
              setError(null);
            }}
          >
            {register ? t('Already have an account? Sign in') : t('New here? Create account')}
          </button>
        )}
        {' · '}
        <Link href="/">{t('Back to shopping')}</Link>
      </p>
    </div>
  );
}
