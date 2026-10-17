'use client';
import Link from 'next/link';
import { LanguageSwitcher, useLocale } from '@/components/locale-provider';
import manual from '@/content/manual.json';
export default function ManualPage() {
  const { locale, t } = useLocale();
  const content = manual[locale];
  return (
    <main className="manual-shell">
      <nav className="manual-nav" aria-label={t('Main navigation')}>
        <Link href="/">← fullstack / toolkit</Link>
        <LanguageSwitcher />
      </nav>
      <h1>{content.title}</h1>
      <p className="manual-intro">{content.intro}</p>
      <nav className="manual-toc" aria-label={t('User manual')}>
        {content.sections.map((section) => (
          <a key={section.id} href={'#' + section.id}>
            {section.title}
          </a>
        ))}
      </nav>
      {content.sections.map((section) => (
        <section className="manual-section" id={section.id} key={section.id}>
          <h2>{section.title}</h2>
          <ol>
            {section.steps.map((step, index) => (
              <li key={index}>{step}</li>
            ))}
          </ol>
        </section>
      ))}
    </main>
  );
}
