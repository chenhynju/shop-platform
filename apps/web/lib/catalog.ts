import type { ShopProduct } from '@repo/types';

export const categories = [
  { id: 'all', label: 'All products', icon: '✳' },
  { id: 'tech', label: 'Tech & accessories', icon: '⌘' },
  { id: 'desk', label: 'Desk essentials', icon: '▤' },
  { id: 'home', label: 'Home & living', icon: '◒' }
] as const;

// Presentation grouping for the current sample catalog, not a merchant taxonomy.
export function categoryOf(product: Pick<ShopProduct, 'sku' | 'name'>): string {
  if (/mug|cup|ceramic|杯/i.test(product.name)) return 'home';
  if (/mat|desk|垫/i.test(product.name)) return 'desk';
  return 'tech';
}

export function productHref(sku: string) {
  return '/shop/product/' + encodeURIComponent(sku);
}
