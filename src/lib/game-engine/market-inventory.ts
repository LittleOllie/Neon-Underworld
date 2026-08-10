import { getCityShopItem, type PlayerShopFields, type ShopItemKey } from '@/config/game/shop-rules';

export function readPlayerItemQuantity(
  player: PlayerShopFields,
  itemKey: ShopItemKey,
): number {
  const rule = getCityShopItem(itemKey);
  if (!rule) return 0;
  return player[rule.field];
}

export function playerItemDelta(
  itemKey: ShopItemKey,
  delta: number,
): Partial<Record<keyof PlayerShopFields, number>> {
  const rule = getCityShopItem(itemKey);
  if (!rule) return {};
  return { [rule.field]: delta };
}
