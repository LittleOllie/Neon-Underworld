import { getCityShopItem } from '@/config/game/shop-rules';
import { REDLITE_NET_WORTH } from '@/config/game/redlite-rules';

/** Purchasable cartel armoury items — AK-47 is player-only per Redlite guide §6. */
export type CartelArmouryItemKey = 'thug' | 'glock' | 'uzi';

export const CARTEL_ARMOURY_MAX_QUANTITY = 1000;

export interface CartelArmouryItemRule {
  key: CartelArmouryItemKey;
  displayName: string;
  field: 'thugs' | 'glocks' | 'uzis';
  unitPrice: number;
  purpose: string;
}

const glockRule = getCityShopItem('glock')!;
const uziRule = getCityShopItem('uzi')!;

export const CARTEL_ARMOURY_ITEMS: CartelArmouryItemRule[] = [
  {
    key: 'thug',
    displayName: 'Thug',
    field: 'thugs',
    unitPrice: REDLITE_NET_WORTH.thugs,
    purpose: 'Shared defence crew — protects all cartel members in drive-by attacks.',
  },
  {
    key: 'glock',
    displayName: 'Glock',
    field: 'glocks',
    unitPrice: glockRule.shopPrice,
    purpose: 'Basic cartel weapon stock — never lost in attacks.',
  },
  {
    key: 'uzi',
    displayName: 'Uzi',
    field: 'uzis',
    unitPrice: uziRule.shopPrice,
    purpose: 'Preferred cartel firepower — never lost in attacks.',
  },
];

export const CARTEL_ARMOURY_ITEM_KEYS = CARTEL_ARMOURY_ITEMS.map((i) => i.key);

export function getCartelArmouryItem(key: string): CartelArmouryItemRule | undefined {
  return CARTEL_ARMOURY_ITEMS.find((i) => i.key === key);
}

export function isCartelArmouryItem(key: string): key is CartelArmouryItemKey {
  return CARTEL_ARMOURY_ITEM_KEYS.includes(key as CartelArmouryItemKey);
}

export function cartelArmouryPurchaseTotal(key: CartelArmouryItemKey, quantity: number): number {
  const rule = getCartelArmouryItem(key)!;
  return rule.unitPrice * quantity;
}
