import { shopLocale } from '@/lib/shop-i18n-server';
import Link from 'next/link';

export default async function ShoppingGuide() {
  const { t } = await shopLocale();
  return (
    <div className="market-guide">
      <p className="market-kicker">{t('SHOP WITH CLARITY')}</p>
      <h1>{t('Your guide to Purelamp')}</h1>
      <p className="market-guide-intro">
        {t('A first look at our marketplace. Here is what you can try today.')}{' '}
      </p>
      <div className="market-guide-grid">
        <section>
          <span>01</span>
          <h2>{t('Explore the collection')}</h2>
          <p>
            {t(
              'Browse sample products, filter by category and availability, and open each item for its description, current price and quantity.'
            )}{' '}
          </p>
        </section>
        <section>
          <span>02</span>
          <h2>{t('Make it your own')}</h2>
          <p>
            {t(
              'Create an account or sign in to keep your cart and orders together. Your cart and order history are private to your account.'
            )}{' '}
          </p>
        </section>
        <section>
          <span>03</span>
          <h2>{t('Try a preview order')}</h2>
          <p>
            {t(
              'Prices currently use CNY (¥). Checkout and payment are demonstrations; no real payment is collected. Sample images are AI-generated or illustrated.'
            )}{' '}
          </p>
        </section>
        <section>
          <span>04</span>
          <h2>{t('Know what comes next')}</h2>
          <p>
            {t(
              'Real delivery, import fees, returns and USD/CAD checkout are not yet available. This preview does not promise shipping or customer protection services.'
            )}{' '}
          </p>
        </section>
      </div>
      <Link href="/shop" className="market-button">
        {t('Explore all products →')}{' '}
      </Link>
    </div>
  );
}
