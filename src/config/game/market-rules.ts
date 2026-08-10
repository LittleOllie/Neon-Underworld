import { REDLITE_MARKET, REDLITE_MARKET_STARTING_PRICES } from './redlite-rules';
import { CITY_SHOP_ITEMS, type ShopItemKey } from './shop-rules';

/** Inventory items players may list on the Market (no personnel, cash, or businesses). */
export const MARKET_TRADABLE_ITEM_KEYS = CITY_SHOP_ITEMS.filter((i) => i.tradable).map(
  (i) => i.key,
) as ShopItemKey[];

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

export function isMarketTradableItem(key: string): key is ShopItemKey {
  return MARKET_TRADABLE_ITEM_KEYS.includes(key as ShopItemKey);
}

export function marketItemDisplayName(key: string): string {
  return CITY_SHOP_ITEMS.find((i) => i.key === key)?.displayName ?? key;
}

export function marketFilterCategory(key: ShopItemKey): 'weapons' | 'rides' | 'drugs' | 'supplies' {
  const item = CITY_SHOP_ITEMS.find((i) => i.key === key);
  if (!item) return 'supplies';
  if (item.category === 'weapons') return 'weapons';
  if (item.category === 'vehicles') return 'rides';
  if (item.category === 'drugs') return 'drugs';
  return 'supplies';
}

export function minimumNextBid(currentBid: number | null, startingPrice: number): number {
  if (currentBid == null) return startingPrice;
  return Math.ceil(currentBid * MARKET_RULES.minBidIncrementRatio);
}
