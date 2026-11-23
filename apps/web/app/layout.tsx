import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { shopLocale } from '@/lib/shop-i18n-server';
import { LocaleProvider } from '@/components/locale-provider';
import './globals.css';

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await shopLocale();
  return {
    title: t('Purelamp | Everyday finds'),
    description: t(
      'Explore the Purelamp catalog, find your next everyday favorite, and manage your cart and orders.'
    )
  };
}

export default async function RootLayout({ children }: { children: ReactNode }) {
  const { locale, messages } = await shopLocale();
  return (
    <html lang={locale}>
      <body className="min-h-screen bg-slate-50 font-sans text-slate-900 antialiased">
        <LocaleProvider initialLocale={locale} commerceMessages={messages}>
          {children}
        </LocaleProvider>
      </body>
    </html>
  );
}
