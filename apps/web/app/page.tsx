import ShopLayout from './shop/layout';
import ShopCatalog from '@/components/shop-catalog';
export default function HomePage() {
  return (
    <ShopLayout>
      <ShopCatalog />
    </ShopLayout>
  );
}
