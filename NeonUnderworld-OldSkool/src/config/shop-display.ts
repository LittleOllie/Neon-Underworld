/** Player-facing shop category grouping (display only — backend categories unchanged). */

import type { ShopCategory, ShopItemKey } from '@core/config/game/shop-rules';
import type { StreetDrugType } from '@core/config/game/drug-street-prices';
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

/** Deep-link to a shop catalog item — resolves tab from item key. */
export function shopHrefForItem(itemKey: string): string {
  const tabByItem: Record<string, OldSkoolShopTab> = {
    glock: 'weapons',
    uzi: 'weapons',
    ak: 'weapons',
    ride: 'vehicles',
    condom: 'supplies',
    hash: 'supplies',
    beer: 'supplies',
    shroom: 'drugs',
    coke: 'drugs',
    heroin: 'drugs',
  };
  const tab = tabByItem[itemKey] ?? 'supplies';
  return `/shop?tab=${tab}&item=${encodeURIComponent(itemKey)}`;
}

export function shopItemFromParam(param: string | undefined): string | null {
  if (!param) return null;
  const normalized = param.trim().toLowerCase();
  const valid = ['glock', 'uzi', 'ak', 'ride', 'condom', 'hash', 'beer', 'shroom', 'coke', 'heroin'];
  return valid.includes(normalized) ? normalized : null;
}

const SHOP_TO_STREET_DRUG: Partial<Record<ShopItemKey, StreetDrugType>> = {
  hash: 'hash',
  shroom: 'shrooms',
  coke: 'coke',
  heroin: 'heroin',
};

export function streetDrugFromShopKey(key: ShopItemKey): StreetDrugType | null {
  return SHOP_TO_STREET_DRUG[key] ?? null;
}

export function resolveShopPageParams(tabParam?: string, itemParam?: string): {
  initialTab: OldSkoolShopTab;
  highlightItem: string | null;
} {
  const highlightItem = shopItemFromParam(itemParam);
  if (tabParam) {
    return { initialTab: oldSkoolTabFromParam(tabParam), highlightItem };
  }
  if (highlightItem) {
    const tabByItem: Record<string, OldSkoolShopTab> = {
      glock: 'weapons',
      uzi: 'weapons',
      ak: 'weapons',
      ride: 'vehicles',
      condom: 'supplies',
      hash: 'supplies',
      beer: 'supplies',
      shroom: 'drugs',
      coke: 'drugs',
      heroin: 'drugs',
    };
    return { initialTab: tabByItem[highlightItem] ?? 'supplies', highlightItem };
  }
  return { initialTab: 'weapons', highlightItem: null };
}
