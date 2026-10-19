import type { ReactNode } from 'react';
import { PortalFrame } from '@/components/portal-frame';
import '../shop/marketplace.css';
export default function SellerLayout({ children }: { children: ReactNode }) {
  return <PortalFrame audience="seller">{children}</PortalFrame>;
}
