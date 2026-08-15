import { REDLITE_MARKET_STARTING_PRICES, REDLITE_NET_WORTH } from './redlite-rules';

/** Worker support hash — above $5 NW/drug unit; convenience premium for guaranteed supply */
export const SHOP_HASH_UNIT_PRICE = 8;

/** Server-validated maximum units per single City Shop purchase. */
export const SHOP_MAX_SINGLE_PURCHASE_QUANTITY = 100_000;

/** Quick-buy quantity presets for late-game bulk purchases. */
export const SHOP_BULK_QUANTITIES = [100, 500, 1000, 5000] as const;

export type ShopCategory =
  | 'weapons'
  | 'vehicles'
  | 'worker_supplies'
  | 'thug_supplies'
  | 'drugs';

export type ShopItemKey =
  | 'glock'
  | 'uzi'
  | 'ak'
  | 'ride'
  | 'condom'
  | 'hash'
  | 'beer'
  | 'shroom'
  | 'coke'
  | 'heroin';

/** Personnel — tradable on future Market, never sold by NPC City Shop */
export type TradablePersonnelKey = 'whore' | 'thug';

export type ItemCatalogKey = ShopItemKey | TradablePersonnelKey;

export interface ShopItemRule {
  key: ShopItemKey;
  displayName: string;
  category: ShopCategory;
  field: keyof PlayerShopFields;
  /** Reference floor price (market / valuation anchor) */
  baseValue: number;
  /** NPC City Shop price — server authoritative */
  shopPrice: number;
  tradable: boolean;
  cityShop: boolean;
  contributesToNetWorth: boolean;
  purpose: string;
}

export interface PersonnelItemRule {
  key: TradablePersonnelKey;
  displayName: string;
  field: 'prostitutes' | 'thugs';
  netWorthValue: number;
  tradable: boolean;
  cityShop: false;
  purpose: string;
}

export type PlayerShopFields = {
  glocks: number;
  uzis: number;
  aks: number;
  rides: number;
  condoms: number;
  hash: number;
  beer: number;
  shrooms: number;
  coke: number;
  heroin: number;
};

/** Canonical valuations for personnel — used for NW, future auctions, attacks */
export const PERSONNEL_CATALOG: PersonnelItemRule[] = [
  {
    key: 'whore',
    displayName: 'Worker',
    field: 'prostitutes',
    netWorthValue: REDLITE_NET_WORTH.prostitutes,
    tradable: true,
    cityShop: false,
    purpose: 'Recruit via Scout, future attacks, or player Market auctions.',
  },
  {
    key: 'thug',
    displayName: 'Thug',
    field: 'thugs',
    netWorthValue: REDLITE_NET_WORTH.thugs,
    tradable: true,
    cityShop: false,
    purpose: 'Recruit via Scout, future attacks, or player Market auctions.',
  },
];

/**
 * City Shop inventory — support assets only.
 * Drugs (except hash) priced inefficiently vs Production / future Market.
 */
export const CITY_SHOP_ITEMS: ShopItemRule[] = [
  {
    key: 'glock',
    displayName: 'Glock',
    category: 'weapons',
    field: 'glocks',
    baseValue: REDLITE_MARKET_STARTING_PRICES.glock,
    shopPrice: 500,
    tradable: true,
    cityShop: true,
    contributesToNetWorth: false,
    purpose: 'Basic weapon coverage for thugs.',
  },
  {
    key: 'uzi',
    displayName: 'Uzi',
    category: 'weapons',
    field: 'uzis',
    baseValue: REDLITE_MARKET_STARTING_PRICES.uzi,
    shopPrice: 1500,
    tradable: true,
    cityShop: true,
    contributesToNetWorth: false,
    purpose: 'Mid-tier firepower for thug readiness.',
  },
  {
    key: 'ak',
    displayName: 'AK-47',
    category: 'weapons',
    field: 'aks',
    baseValue: REDLITE_MARKET_STARTING_PRICES.ak,
    shopPrice: 3800,
    tradable: true,
    cityShop: true,
    contributesToNetWorth: false,
    purpose: 'Best weapon coverage and combat strength.',
  },
  {
    key: 'ride',
    displayName: 'Ride',
    category: 'vehicles',
    field: 'rides',
    baseValue: REDLITE_NET_WORTH.rides,
    shopPrice: 2500,
    tradable: true,
    cityShop: true,
    contributesToNetWorth: true,
    purpose: 'Transport capacity for future operations and travel.',
  },
  {
    key: 'condom',
    displayName: 'Condoms',
    category: 'worker_supplies',
    field: 'condoms',
    baseValue: REDLITE_MARKET_STARTING_PRICES.condom,
    shopPrice: 2,
    tradable: true,
    cityShop: true,
    contributesToNetWorth: false,
    purpose: 'Supports worker stability.',
  },
  {
    key: 'hash',
    displayName: 'Hash',
    category: 'worker_supplies',
    field: 'hash',
    baseValue: REDLITE_MARKET_STARTING_PRICES.hash,
    shopPrice: SHOP_HASH_UNIT_PRICE,
    tradable: true,
    cityShop: true,
    contributesToNetWorth: true,
    purpose: 'Core worker support supply.',
  },
  {
    key: 'beer',
    displayName: 'Beer',
    category: 'thug_supplies',
    field: 'beer',
    baseValue: REDLITE_MARKET_STARTING_PRICES.beer,
    shopPrice: 4,
    tradable: true,
    cityShop: true,
    contributesToNetWorth: false,
    purpose: 'Keeps thugs content and ready.',
  },
  {
    key: 'shroom',
    displayName: 'Shrooms',
    category: 'drugs',
    field: 'shrooms',
    baseValue: REDLITE_MARKET_STARTING_PRICES.shroom,
    shopPrice: 30,
    tradable: true,
    cityShop: true,
    contributesToNetWorth: true,
    purpose: 'Emergency stock — Producing is far cheaper.',
  },
  {
    key: 'coke',
    displayName: 'Coke',
    category: 'drugs',
    field: 'coke',
    baseValue: REDLITE_MARKET_STARTING_PRICES.coke,
    shopPrice: 55,
    tradable: true,
    cityShop: true,
    contributesToNetWorth: true,
    purpose: 'Emergency stock — Producing is far cheaper.',
  },
  {
    key: 'heroin',
    displayName: 'Heroin',
    category: 'drugs',
    field: 'heroin',
    baseValue: REDLITE_MARKET_STARTING_PRICES.heroin,
    shopPrice: 75,
    tradable: true,
    cityShop: true,
    contributesToNetWorth: true,
    purpose: 'Emergency stock — Producing is far cheaper.',
  },
];

/** Fraction of City Shop buy price returned when selling items back. */
export const CITY_SHOP_SELL_BACK_RATIO = 0.7;

/** City Shop sell-back price — always below buy price. */
export function getCityShopSellPrice(key: ShopItemKey): number {
  const item = getCityShopItem(key);
  if (!item) return 0;
  return Math.max(1, Math.floor(item.shopPrice * CITY_SHOP_SELL_BACK_RATIO));
}

export const CITY_SHOP_ITEM_KEYS = CITY_SHOP_ITEMS.map((i) => i.key) as ShopItemKey[];

export const SHOP_CATEGORY_ORDER: ShopCategory[] = [
  'weapons',
  'vehicles',
  'worker_supplies',
  'thug_supplies',
  'drugs',
];

export const SHOP_CATEGORY_LABELS: Record<ShopCategory, string> = {
  weapons: 'Weapons',
  vehicles: 'Vehicles',
  worker_supplies: 'Worker Supplies',
  thug_supplies: 'Thug Supplies',
  drugs: 'Drugs',
};

export function getCityShopItem(key: string): ShopItemRule | undefined {
  return CITY_SHOP_ITEMS.find((i) => i.key === key);
}

export function isCityShopItem(key: string): key is ShopItemKey {
  return CITY_SHOP_ITEM_KEYS.includes(key as ShopItemKey);
}

export function isPersonnelItem(key: string): key is TradablePersonnelKey {
  return key === 'whore' || key === 'thug';
}

export function getPersonnelItem(key: string): PersonnelItemRule | undefined {
  return PERSONNEL_CATALOG.find((i) => i.key === key);
}

export function getShopItemsByCategory(): Record<ShopCategory, ShopItemRule[]> {
  const grouped = {} as Record<ShopCategory, ShopItemRule[]>;
  for (const cat of SHOP_CATEGORY_ORDER) {
    grouped[cat] = CITY_SHOP_ITEMS.filter((i) => i.category === cat);
  }
  return grouped;
}

/** Canonical net-worth unit value for a City Shop item (0 when excluded from NW). */
export function shopItemNetWorthUnitValue(key: ShopItemKey): number {
  if (key === 'ride') return REDLITE_NET_WORTH.rides;
  if (key === 'hash' || key === 'shroom' || key === 'coke' || key === 'heroin') {
    return REDLITE_NET_WORTH.hash;
  }
  return 0;
}

/** Net-worth change from buying `quantity` units (negative or zero expected for NPC shop). */
export function shopPurchaseNetWorthDelta(item: ShopItemRule, quantity: number): number {
  if (!item.contributesToNetWorth || quantity <= 0) return 0;
  const nwGain = shopItemNetWorthUnitValue(item.key) * quantity;
  const cost = item.shopPrice * quantity;
  return nwGain - cost;
}

export interface CityShopPricingViolation {
  key: ShopItemKey;
  shopPrice: number;
  netWorthValue: number;
}

/** Guardrail: unlimited NPC purchases must not manufacture net worth. */
export function validateCityShopPricing(): {
  valid: boolean;
  violations: CityShopPricingViolation[];
} {
  const violations: CityShopPricingViolation[] = [];
  for (const item of CITY_SHOP_ITEMS) {
    if (!item.contributesToNetWorth) continue;
    const netWorthValue = shopItemNetWorthUnitValue(item.key);
    if (item.shopPrice <= netWorthValue) {
      violations.push({ key: item.key, shopPrice: item.shopPrice, netWorthValue });
    }
  }
  return { valid: violations.length === 0, violations };
}
