'use client';
import Link from 'next/link';
import { useState, type FormEvent } from 'react';
import { useLocale } from '@/components/locale-provider';
import { api } from '@/lib/api';
import { localizeError } from '@/lib/localize-error';
import { CART_CHANGED_EVENT } from '@/lib/shop';
import type { ApiResponse, User } from '@repo/types';

export function ShopLogin({ onSuccess }: { onSuccess: (user: User) => void }) {
  const { locale } = useLocale();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    const data = new FormData(event.currentTarget);
    try {
      const result = await api<ApiResponse<User>>('/auth/login', {
        method: 'POST',
        body: JSON.stringify({
          email: String(data.get('email')),
          password: String(data.get('password'))
        })
      });
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
      <span className="eyebrow">ACCOUNT REQUIRED</span>
      <h1>Sign in to continue</h1>
      <p>
        Your cart and orders are private to your account. Sign in with your workspace account to
        keep shopping.
      </p>
      {Boolean(error) && (
        <p role="alert" className="form-error">
          {localizeError(error, locale)}
        </p>
      )}
      <form onSubmit={submit}>
        <label>
          Email address
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
          Password
          <input
            name="password"
            type="password"
            autoComplete="current-password"
            required
            minLength={12}
            maxLength={128}
            placeholder="At least 12 characters"
          />
        </label>
        <button className="button primary full-width" disabled={busy}>
          {busy ? 'Signing in…' : 'Sign in'} <span aria-hidden="true">↗</span>
        </button>
      </form>
      <p className="shop-login-footnote">
        New here? <Link href="/">Create an account from the workspace home page</Link>.
      </p>
    </div>
  );
}
