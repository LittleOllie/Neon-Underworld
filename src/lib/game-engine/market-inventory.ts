import {
  getCityShopItem,
  getPersonnelItem,
  type ItemCatalogKey,
  type PlayerShopFields,
} from '@/config/game/shop-rules';

export type MarketPlayerInventory = PlayerShopFields & {
  prostitutes: number;
  thugs: number;
};

export function readPlayerItemQuantity(
  player: MarketPlayerInventory,
  itemKey: ItemCatalogKey,
): number {
  const shop = getCityShopItem(itemKey);
  if (shop) return player[shop.field];
  const personnel = getPersonnelItem(itemKey);
  if (personnel) return player[personnel.field];
  return 0;
}

/** Prisma atomic increment payload — use with adjustPlayerItem after balance checks. */
export function playerItemIncrement(
  itemKey: ItemCatalogKey,
  delta: number,
): Record<string, { increment: number }> {
  const shop = getCityShopItem(itemKey);
  if (shop) return { [shop.field]: { increment: delta } };
  const personnel = getPersonnelItem(itemKey);
  if (personnel) return { [personnel.field]: { increment: delta } };
  return {};
}
