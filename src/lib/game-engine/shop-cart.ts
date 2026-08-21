import {
  CITY_SHOP_ITEM_KEYS,
  getCityShopItem,
  isCityShopItem,
  isPersonnelItem,
  SHOP_MAX_SINGLE_PURCHASE_QUANTITY,
  type ShopItemKey,
} from '@/config/game/shop-rules';
import { THUG_HIRE_PRICE, hireThugsTotalCost } from '@/config/game/hire-thugs-rules';
import type { Prisma } from '@prisma/client';

/** Supply-order line keys — catalog items plus Shop crew hiring. */
export type ShopCartLineKey = ShopItemKey | 'thugs';

export const SHOP_CART_LINE_KEYS = [...CITY_SHOP_ITEM_KEYS, 'thugs'] as const;

export const SHOP_CART_MAX_DISTINCT_LINES = SHOP_CART_LINE_KEYS.length;

export interface ShopCartLineInput {
  itemId: ShopCartLineKey;
  quantity: number;
}

export interface ResolvedShopCartLine {
  itemId: ShopCartLineKey;
  displayName: string;
  quantity: number;
  unitPrice: number;
  lineCost: number;
  inventoryField: keyof Prisma.PlayerUpdateInput | null;
}

export function isShopCartLineKey(value: string): value is ShopCartLineKey {
  if (value === 'thugs') return true;
  return isCityShopItem(value);
}

/** Merge duplicate item lines — quantities add. */
export function mergeShopCartLines(lines: ShopCartLineInput[]): ShopCartLineInput[] {
  const merged = new Map<ShopCartLineKey, number>();
  for (const line of lines) {
    merged.set(line.itemId, (merged.get(line.itemId) ?? 0) + line.quantity);
  }
  return [...merged.entries()].map(([itemId, quantity]) => ({ itemId, quantity }));
}

export function resolveShopCartLine(itemId: ShopCartLineKey, quantity: number): ResolvedShopCartLine {
  if (itemId === 'thugs') {
    return {
      itemId,
      displayName: 'Thugs',
      quantity,
      unitPrice: THUG_HIRE_PRICE,
      lineCost: hireThugsTotalCost(quantity),
      inventoryField: 'thugs',
    };
  }

  const rule = getCityShopItem(itemId)!;
  return {
    itemId,
    displayName: rule.displayName,
    quantity,
    unitPrice: rule.shopPrice,
    lineCost: rule.shopPrice * quantity,
    inventoryField: rule.field as keyof Prisma.PlayerUpdateInput,
  };
}

export function calculateShopCartTotalCost(lines: ShopCartLineInput[]): number {
  return mergeShopCartLines(lines).reduce((sum, line) => {
    const resolved = resolveShopCartLine(line.itemId, line.quantity);
    return sum + resolved.lineCost;
  }, 0);
}

export function validateShopCartLineQuantity(quantity: number): string | null {
  if (!Number.isInteger(quantity) || quantity < 1) {
    return 'Quantity must be a positive whole number.';
  }
  if (quantity > SHOP_MAX_SINGLE_PURCHASE_QUANTITY) {
    return `Maximum ${SHOP_MAX_SINGLE_PURCHASE_QUANTITY.toLocaleString()} units per item.`;
  }
  return null;
}

export function validateShopCartLineItemId(itemId: string): string | null {
  if (isPersonnelItem(itemId) && itemId !== 'thug') {
    return 'Workers cannot be purchased from the City Shop.';
  }
  if (itemId === 'thug') {
    return 'Use thugs as the crew order line.';
  }
  if (!isShopCartLineKey(itemId)) {
    return 'One item in your order is no longer available.';
  }
  return null;
}

export function validateShopCartPlayerContext(
  player: { cash: number; lifeStatus: string; travelling: boolean },
): string | null {
  if (player.lifeStatus !== 'ACTIVE') {
    return 'Purchases unavailable in your current status.';
  }
  if (player.travelling) {
    return 'Purchases unavailable while travelling.';
  }
  return null;
}

export function validateShopCartOrder(
  player: { cash: number; lifeStatus: string; travelling: boolean },
  rawLines: ShopCartLineInput[],
): { ok: true; lines: ResolvedShopCartLine[]; totalCost: number } | { ok: false; error: string } {
  const playerError = validateShopCartPlayerContext(player);
  if (playerError) return { ok: false, error: playerError };

  if (!Array.isArray(rawLines) || rawLines.length === 0) {
    return { ok: false, error: 'Your supply order is empty.' };
  }
  if (rawLines.length > SHOP_CART_MAX_DISTINCT_LINES) {
    return { ok: false, error: 'Too many item types in your order.' };
  }

  const merged = mergeShopCartLines(rawLines);
  if (merged.length > SHOP_CART_MAX_DISTINCT_LINES) {
    return { ok: false, error: 'Too many item types in your order.' };
  }

  const resolved: ResolvedShopCartLine[] = [];
  let totalCost = 0;

  for (const line of merged) {
    const itemError = validateShopCartLineItemId(line.itemId);
    if (itemError) return { ok: false, error: itemError };

    const qtyError = validateShopCartLineQuantity(line.quantity);
    if (qtyError) return { ok: false, error: qtyError };

    const entry = resolveShopCartLine(line.itemId, line.quantity);
    if (!Number.isFinite(entry.lineCost) || entry.lineCost <= 0) {
      return { ok: false, error: 'Invalid purchase total.' };
    }

    totalCost += entry.lineCost;
    if (!Number.isFinite(totalCost) || totalCost <= 0) {
      return { ok: false, error: 'Invalid purchase total.' };
    }
    if (totalCost > Number.MAX_SAFE_INTEGER) {
      return { ok: false, error: 'Order total exceeds safe limits.' };
    }

    resolved.push(entry);
  }

  if (totalCost > player.cash) {
    return {
      ok: false,
      error: `Your order costs $${totalCost.toLocaleString()}. You currently have $${player.cash.toLocaleString()}.`,
    };
  }

  return { ok: true, lines: resolved, totalCost };
}

export function buildShopCartPlayerUpdate(
  lines: ResolvedShopCartLine[],
  totalCost: number,
): Prisma.PlayerUpdateInput {
  const data: Prisma.PlayerUpdateInput = {
    cash: { decrement: totalCost },
  };

  for (const line of lines) {
    if (!line.inventoryField) continue;
    const field = line.inventoryField;
    const existing = data[field];
    if (
      existing &&
      typeof existing === 'object' &&
      'increment' in existing &&
      typeof existing.increment === 'number'
    ) {
      (data[field] as { increment: number }).increment += line.quantity;
    } else {
      data[field] = { increment: line.quantity };
    }
  }

  return data;
}

export function shopCartAnalyticsFlags(lines: ResolvedShopCartLine[]) {
  const itemIds = new Set(lines.map((l) => l.itemId));
  return {
    itemTypeCount: lines.length,
    totalUnits: lines.reduce((sum, l) => sum + l.quantity, 0),
    containsThugs: itemIds.has('thugs'),
    containsRides: itemIds.has('ride'),
    containsWeapons: itemIds.has('glock') || itemIds.has('uzi') || itemIds.has('ak'),
    containsSupplies:
      itemIds.has('beer') ||
      itemIds.has('condom') ||
      itemIds.has('hash') ||
      itemIds.has('shroom') ||
      itemIds.has('coke') ||
      itemIds.has('heroin'),
  };
}
