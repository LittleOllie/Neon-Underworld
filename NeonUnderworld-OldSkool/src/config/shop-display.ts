/** Player-facing shop category grouping (display only — backend categories unchanged). */

import type { ShopCategory } from '@core/config/game/shop-rules';
import type { GameIconName } from '@local/config/game-icons';

export type OldSkoolShopTab = 'weapons' | 'vehicles' | 'supplies' | 'drugs';

export const OLDSKOOL_SHOP_TABS: {
  id: OldSkoolShopTab;
  label: string;
  icon: GameIconName;
  categories: ShopCategory[];
}[] = [
  { id: 'weapons', label: 'Weapons', icon: 'weapons', categories: ['weapons'] },
  { id: 'vehicles', label: 'Vehicles', icon: 'vehicles', categories: ['vehicles'] },
  { id: 'supplies', label: 'Supplies', icon: 'supplies', categories: ['worker_supplies', 'thug_supplies'] },
  { id: 'drugs', label: 'Drugs', icon: 'drugs', categories: ['drugs'] },
];

export function oldSkoolTabFromParam(param: string | undefined): OldSkoolShopTab {
  const found = OLDSKOOL_SHOP_TABS.find((t) => t.id === param);
  return found?.id ?? 'weapons';
}
