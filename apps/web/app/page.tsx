import ShopLayout from './shop/layout';
import ShopCatalog from '@/components/shop-catalog';
import { MarketplaceHero, MarketplaceBottom } from '@/components/marketplace-editorial';
export default function HomePage() {
  return (
    <ShopLayout>
      <ShopCatalog hero={<MarketplaceHero />} bottom={<MarketplaceBottom />} />
    </ShopLayout>
  );
}
