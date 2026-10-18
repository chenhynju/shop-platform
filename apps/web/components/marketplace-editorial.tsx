import Link from 'next/link';
import { ProductMedia } from './product-media';
export function MarketplaceHero() {
  return (
    <section className="market-hero-grid" aria-label="Discover the collection">
      <div className="market-hero">
        <div className="market-hero-copy">
          <span className="market-kicker">THE EVERYDAY EDIT</span>
          <h1>
            Your everyday,
            <br />
            upgraded.
          </h1>
          <p>
            A better desk. A slower coffee.
            <br />
            Find the little things that make a difference.
          </p>
          <Link className="market-button" href="/shop?category=tech">
            Explore tech & accessories <span aria-hidden="true">→</span>
          </Link>
        </div>
        <ProductMedia name="Desk collection" scene priority />
        <span className="market-image-label">AI-generated sample imagery</span>
      </div>
      <div className="market-mini-promos">
        <Link href="/shop?category=home" className="market-mini home">
          <div>
            <span className="market-kicker">HOME & LIVING</span>
            <h2>
              A little more
              <br />
              feel-good.
            </h2>
            <span>Explore the collection →</span>
          </div>
          <ProductMedia name="Ceramic mug" priority />
        </Link>
        <Link href="/shop?category=desk" className="market-mini desk">
          <div>
            <span className="market-kicker">DESK ESSENTIALS</span>
            <h2>
              Make space
              <br />
              for focus.
            </h2>
            <span>Find your desk essentials →</span>
          </div>
          <ProductMedia name="Desk mat" priority />
        </Link>
      </div>
    </section>
  );
}
export function MarketplaceBottom() {
  return (
    <>
      {' '}
      <section className="market-bottom-banner">
        <div>
          <span className="market-kicker">YOUR NEXT FIND IS WAITING</span>
          <h2>A place for your everyday favorites.</h2>
          <p>Create an account to keep your cart and orders together.</p>
        </div>
        <Link href="/account" className="market-button">
          Your Purelamp account →
        </Link>
      </section>
      <p className="catalog-note">
        Preview catalog · Prices in CNY (¥) · AI-generated sample images · Simulated payments.
        Delivery, returns and USD/CAD checkout are not yet available.
      </p>
    </>
  );
}
