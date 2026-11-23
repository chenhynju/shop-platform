import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { cookies } from 'next/headers';
import { localeCookie, resolveLocale } from '@toolkit/i18n';
import { LocaleProvider } from '@/components/locale-provider';
import './globals.css';

export const metadata: Metadata = {
  title: 'Purelamp | Everyday finds',
  description:
    'Explore the Purelamp catalog, find your next everyday favorite, and manage your cart and orders.'
};

export default async function RootLayout({ children }: { children: ReactNode }) {
  const locale = resolveLocale((await cookies()).get(localeCookie)?.value);
  return (
    <html lang={locale}>
      <body className="min-h-screen bg-slate-50 font-sans text-slate-900 antialiased">
        <LocaleProvider initialLocale={locale}>{children}</LocaleProvider>
      </body>
    </html>
  );
}
