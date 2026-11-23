'use client';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { LanguageSwitcher, useLocale } from './locale-provider';
export function ManualViewer({ english, chinese }: { english: ReactNode; chinese: ReactNode }) {
  const { locale, t } = useLocale();
  return (
    <main className="manual-shell">
      <nav className="manual-nav" aria-label={t('Main navigation')}>
        <Link href="/workspace">← fullstack / toolkit</Link>
        <LanguageSwitcher />
      </nav>
      {locale === 'zh-CN' ? chinese : english}
    </main>
  );
}
