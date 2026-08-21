import { getCityShopItem } from '@/config/game/shop-rules';
import { REDLITE_NET_WORTH } from '@/config/game/redlite-rules';
import { TERMS } from '@/config/game/terminology';

/** Purchasable cartel armoury items — AK-47 is player-only per Redlite guide §6. */
export type CartelArmouryItemKey = 'thug' | 'glock' | 'uzi' | 'ride';

export const CARTEL_ARMOURY_MAX_QUANTITY = 1000;
export const CARTEL_RIDE_UNIT_PRICE = 5_000;

export interface CartelArmouryItemRule {
  key: CartelArmouryItemKey;
  displayName: string;
  field: 'thugs' | 'glocks' | 'uzis' | 'rides';
  unitPrice: number;
  purpose: string;
}

const glockRule = getCityShopItem('glock')!;
const uziRule = getCityShopItem('uzi')!;

export const CARTEL_ARMOURY_ITEMS: CartelArmouryItemRule[] = [
  {
    key: 'thug',
    displayName: TERMS.enforcer,
    field: 'thugs',
    unitPrice: REDLITE_NET_WORTH.thugs,
    purpose: `Shared defence crew — protects all ${TERMS.faction.toLowerCase()} members during attacks.`,
  },
  {
    key: 'glock',
    displayName: TERMS.glock,
    field: 'glocks',
    unitPrice: glockRule.shopPrice,
    purpose: `Basic ${TERMS.faction.toLowerCase()} weapon stock — never lost in attacks.`,
  },
  {
    key: 'uzi',
    displayName: TERMS.uzi,
    field: 'uzis',
    unitPrice: uziRule.shopPrice,
    purpose: `Preferred ${TERMS.faction.toLowerCase()} firepower — never lost in attacks.`,
  },
  {
    key: 'ride',
    displayName: TERMS.ride,
    field: 'rides',
    unitPrice: CARTEL_RIDE_UNIT_PRICE,
    purpose: `${TERMS.faction} transport — each ride carries 5 ${TERMS.enforcers.toLowerCase()} for response force defence.`,
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
