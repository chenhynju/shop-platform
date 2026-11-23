import Link from 'next/link';

export default function ShoppingGuide() {
  return (
    <div className="market-guide">
      <p className="market-kicker">SHOP WITH CLARITY</p>
      <h1>Your guide to Purelamp</h1>
      <p className="market-guide-intro">
        A first look at our marketplace. Here is what you can try today.
      </p>
      <div className="market-guide-grid">
        <section>
          <span>01</span>
          <h2>Explore the collection</h2>
          <p>
            Browse sample products, filter by category and availability, and open each item for its
            description, current price and quantity.
          </p>
        </section>
        <section>
          <span>02</span>
          <h2>Make it your own</h2>
          <p>
            Create an account or sign in to keep your cart and orders together. Your cart and order
            history are private to your account.
          </p>
        </section>
        <section>
          <span>03</span>
          <h2>Try a preview order</h2>
          <p>
            Prices currently use CNY (¥). Checkout and payment are demonstrations; no real payment
            is collected. Sample images are AI-generated or illustrated.
          </p>
        </section>
        <section>
          <span>04</span>
          <h2>Know what comes next</h2>
          <p>
            Real delivery, import fees, returns and USD/CAD checkout are not yet available. This
            preview does not promise shipping or customer protection services.
          </p>
        </section>
      </div>
      <Link href="/shop" className="market-button">
        Explore all products →
      </Link>
    </div>
  );
}
