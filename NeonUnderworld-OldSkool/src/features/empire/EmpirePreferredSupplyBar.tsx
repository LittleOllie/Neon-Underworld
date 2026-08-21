'use client';

import Link from 'next/link';
import { StatusBar } from '@local/components/game/StatusBar';
import { shopHrefForItem } from '@local/config/shop-display';

type Props = {
  itemKey: string;
  label: string;
  quantity: number;
  readinessPercent: number;
};

/** Collapsed-header supply meter — tap opens shop on the preferred item. */
export function EmpirePreferredSupplyBar({ itemKey, label, quantity, readinessPercent }: Props) {
  return (
    <Link
      href={shopHrefForItem(itemKey)}
      className="g-empire-supply-bar"
      onClick={(event) => event.stopPropagation()}
    >
      <StatusBar
        label={label}
        percent={readinessPercent}
        right={`${quantity.toLocaleString()} in stock`}
      />
    </Link>
  );
}
