import { shopLocale } from '@/lib/shop-i18n-server';
import type { ReactNode } from 'react';
import { ShopNav } from '@/components/shop-nav';
import './marketplace.css';

export default async function ShopLayout({ children }: { children: ReactNode }) {
  const { t } = await shopLocale();
  return (
    <div className="shop-shell">
      <ShopNav />
      <main className="shop-main">{children}</main>
      <footer className="market-footer">
        <div className="market-footer-inner">
          <div>
            <strong>
              purelamp<span>.</span>
            </strong>
            <p>{t('Everyday finds. A world of possibilities.')}</p>
            <small>{t('Preview marketplace · Simulated payments')}</small>
          </div>
          <div>
            <h2>{t('Explore')}</h2>
            <a href="/shop">{t('All products')}</a>
            <a href="/shop?category=tech">{t('Tech & accessories')}</a>
            <a href="/shop?category=home">{t('Home & living')}</a>
          </div>
          <div>
            <h2>{t('Your shopping')}</h2>
            <a href="/account">{t('Your account')}</a>
            <a href="/shop/cart">{t('Shopping cart')}</a>
            <a href="/shop/orders">{t('Your orders')}</a>
          </div>
          <div>
            <h2>{t('Good to know')}</h2>
            <a href="/seller">{t('Merchant center')}</a>
            <a href="/admin">{t('Platform administration')}</a>
            <a href="/shop/guide">{t('Shopping guide')}</a>
            <p>
              {t('Sample prices in CNY.')} <br />
              {t('Real delivery is not yet available.')}{' '}
            </p>
          </div>
        </div>
        <div className="market-footer-bottom">
          © {new Date().getFullYear()} Purelamp{' '}
          <span>{t('AI-generated sample imagery · Preview release')}</span>
        </div>
      </footer>
    </div>
  );
}
