import { shopLocale } from '@/lib/shop-i18n-server';
import Link from 'next/link';
import { ProductMedia } from './product-media';
export async function MarketplaceHero() {
  const { t } = await shopLocale();
  return (
    <section className="market-hero-grid" aria-label={t('Discover the collection')}>
      <div className="market-hero">
        <div className="market-hero-copy">
          <span className="market-kicker">{t('THE EVERYDAY EDIT')}</span>
          <h1>
            {t('Your everyday,')} <br />
            {t('upgraded.')}{' '}
          </h1>
          <p>
            {t('A better desk. A slower coffee.')} <br />
            {t('Find the little things that make a difference.')}{' '}
          </p>
          <Link className="market-button" href="/shop?category=tech">
            {t('Explore tech & accessories')} <span aria-hidden="true">→</span>
          </Link>
        </div>
        <ProductMedia name="Desk collection" scene priority />
        <span className="market-image-label">{t('AI-generated sample imagery')}</span>
      </div>
      <div className="market-mini-promos">
        <Link href="/shop?category=home" className="market-mini home">
          <div>
            <span className="market-kicker">{t('HOME & LIVING')}</span>
            <h2>
              {t('A little more')} <br />
              {t('feel-good.')}{' '}
            </h2>
            <span>{t('Explore the collection →')}</span>
          </div>
          <ProductMedia name="Ceramic mug" priority />
        </Link>
        <Link href="/shop?category=desk" className="market-mini desk">
          <div>
            <span className="market-kicker">{t('DESK ESSENTIALS')}</span>
            <h2>
              {t('Make space')} <br />
              {t('for focus.')}{' '}
            </h2>
            <span>{t('Find your desk essentials →')}</span>
          </div>
          <ProductMedia name="Desk mat" priority />
        </Link>
      </div>
    </section>
  );
}
export async function MarketplaceBottom() {
  const { t } = await shopLocale();
  return (
    <>
      {' '}
      <section className="market-bottom-banner">
        <div>
          <span className="market-kicker">{t('YOUR NEXT FIND IS WAITING')}</span>
          <h2>{t('A place for your everyday favorites.')}</h2>
          <p>{t('Create an account to keep your cart and orders together.')}</p>
        </div>
        <Link href="/account" className="market-button">
          {t('Your Purelamp account →')}{' '}
        </Link>
      </section>
      <p className="catalog-note">
        {t(
          'Preview catalog · Prices in CNY (¥) · AI-generated sample images · Simulated payments. Delivery, returns and USD/CAD checkout are not yet available.'
        )}{' '}
      </p>
    </>
  );
}
