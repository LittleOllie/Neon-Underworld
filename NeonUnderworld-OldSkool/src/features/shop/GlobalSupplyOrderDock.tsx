'use client';

import { usePathname, useRouter } from 'next/navigation';
import { SupplyOrderBar } from './SupplyOrderBar';
import { useSupplyOrder } from './SupplyOrderProvider';

/** Sticky supply-order review bar — visible on any game page when the cart has items. */
export function GlobalSupplyOrderDock() {
  const pathname = usePathname();
  const router = useRouter();
  const { hasItems, itemTypeCount, estimatedTotal, reviewOpen, openReview } = useSupplyOrder();

  if (!hasItems) return null;

  function handleReview() {
    if (pathname.startsWith('/shop')) {
      openReview();
      return;
    }
    router.push('/shop?review=1');
  }

  return (
    <SupplyOrderBar
      variant="global"
      itemTypeCount={itemTypeCount}
      estimatedTotal={estimatedTotal}
      locked={reviewOpen}
      onReview={handleReview}
    />
  );
}
