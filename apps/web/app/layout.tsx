import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { cookies } from 'next/headers';
import { localeCookie, resolveLocale } from '@toolkit/i18n';
import { LocaleProvider } from '@/components/locale-provider';
import './globals.css';

export const metadata: Metadata = {
  title: 'fullstack-toolkit',
  description:
    'A reusable full-stack foundation with authentication, private projects and deployment tooling.'
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
