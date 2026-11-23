import ShopCatalog from '@/components/shop-catalog';
import { MarketplaceHero, MarketplaceBottom } from '@/components/marketplace-editorial';
export default function ShopPage() {
  return <ShopCatalog hero={<MarketplaceHero />} bottom={<MarketplaceBottom />} />;
}
