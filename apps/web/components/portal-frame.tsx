'use client';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { LanguageSwitcher, useLocale } from './locale-provider';
export function PortalFrame({
  audience,
  children
}: {
  audience: 'seller' | 'admin';
  children: ReactNode;
}) {
  const { st: t } = useLocale();
  return (
    <div className="shop-shell">
      <header className="shop-header">
        <div className="shop-header-inner">
          <Link className="shop-brand" href="/">
            purelamp.
          </Link>
          <strong>
            {t(audience === 'seller' ? 'Merchant center' : 'Platform administration')}
          </strong>
          <LanguageSwitcher />
          <Link href={audience === 'seller' ? '/admin' : '/seller'}>
            {t(audience === 'seller' ? 'Platform administration' : 'Merchant center')}
          </Link>
          <Link href="/">{t('Back to shopping')}</Link>
        </div>
      </header>
      <main className="shop-main">{children}</main>
    </div>
  );
}
