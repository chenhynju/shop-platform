import type { ReactNode } from 'react';
import { PortalFrame } from '@/components/portal-frame';
import '../shop/marketplace.css';
export default function AdminLayout({ children }: { children: ReactNode }) {
  return <PortalFrame audience="admin">{children}</PortalFrame>;
}
