import { REDLITE_MARKET, REDLITE_MARKET_STARTING_PRICES } from './redlite-rules';
import {
  CITY_SHOP_ITEMS,
  PERSONNEL_CATALOG,
  getCityShopItem,
  getPersonnelItem,
  type ItemCatalogKey,
  type ShopItemKey,
} from './shop-rules';

/** Shop inventory + personnel players may list on the Market (no cash or businesses). */
export const MARKET_TRADABLE_SHOP_KEYS = CITY_SHOP_ITEMS.filter((i) => i.tradable).map(
  (i) => i.key,
) as ShopItemKey[];

export const MARKET_TRADABLE_PERSONNEL_KEYS = PERSONNEL_CATALOG.filter((i) => i.tradable).map(
  (i) => i.key,
);

export const MARKET_TRADABLE_ITEM_KEYS = [
  ...MARKET_TRADABLE_SHOP_KEYS,
  ...MARKET_TRADABLE_PERSONNEL_KEYS,
] as const;

export type MarketTradableItemKey = (typeof MARKET_TRADABLE_ITEM_KEYS)[number];

export type MarketFilterCategory = 'weapons' | 'rides' | 'drugs' | 'supplies' | 'personnel';

export const MARKET_RULES = {
  /** Global market — not city-scoped in v1 */
  global: true,
  minStartingPrice: Math.max(10, REDLITE_MARKET_STARTING_PRICES.beer),
  minBidIncrementRatio: 1 + REDLITE_MARKET.bidIncrementPercent / 100,
  allowedDurationMinutes: [30, 60, 180, 360, 720, 1440] as const,
  minDurationMinutes: 30,
  maxDurationMinutes: 1440,
  maxQuantityPerListing: 1000,
  tradableItemKeys: MARKET_TRADABLE_ITEM_KEYS,
} as const;

export type MarketDurationMinutes = (typeof MARKET_RULES.allowedDurationMinutes)[number];

export function isMarketTradableItem(key: string): key is MarketTradableItemKey {
  return MARKET_TRADABLE_ITEM_KEYS.includes(key as MarketTradableItemKey);
}

export function marketItemDisplayName(key: string): string {
  return getCityShopItem(key)?.displayName ?? getPersonnelItem(key)?.displayName ?? key;
}

export function marketFilterCategory(key: string): MarketFilterCategory {
  if (key === 'whore' || key === 'thug') return 'personnel';
  const item = getCityShopItem(key);
  if (!item) return 'supplies';
  if (item.category === 'weapons') return 'weapons';
  if (item.category === 'vehicles') return 'rides';
  if (item.category === 'drugs') return 'drugs';
  return 'supplies';
}

export function listingMatchesMarketFilter(
  itemKey: string,
  filter: MarketFilterCategory | 'all',
): boolean {
  if (filter === 'all') return true;
  return marketFilterCategory(itemKey) === filter;
}

export function minimumNextBid(currentBid: number | null, startingPrice: number): number {
  if (currentBid == null) return startingPrice;
  return Math.ceil(currentBid * MARKET_RULES.minBidIncrementRatio);
}

export type { ItemCatalogKey };
