import type { ShopCartLineKey } from '@core/server/actions/shop.actions';
import { SHOP_MAX_SINGLE_PURCHASE_QUANTITY } from '@core/config/game/shop-rules';
import { THUG_HIRE_PRICE } from '@core/config/game/hire-thugs-rules';
import {
  calculateShopCartTotalCost,
  mergeShopCartLines,
  resolveShopCartLine,
  type ShopCartLineInput,
} from '@core/lib/game-engine/shop-cart';
import { maxAffordableQuantity } from '@local/lib/numeric-input';
import { TERMS } from '@core/config/game/terminology';

export type SupplyOrderLine = ShopCartLineInput;

export type SupplyOrderCatalogPrice = {
  itemId: ShopCartLineKey;
  unitPrice: number;
  displayName: string;
};

export function mergeSupplyOrderLines(lines: SupplyOrderLine[]): SupplyOrderLine[] {
  return mergeShopCartLines(lines);
}

export function estimateSupplyOrderTotal(lines: SupplyOrderLine[]): number {
  if (lines.length === 0) return 0;
  return calculateShopCartTotalCost(lines);
}

export function estimateSupplyOrderUnits(lines: SupplyOrderLine[]): number {
  return mergeSupplyOrderLines(lines).reduce((sum, line) => sum + line.quantity, 0);
}

export function resolveCatalogUnitPrice(
  itemId: ShopCartLineKey,
  catalog: SupplyOrderCatalogPrice[],
): number {
  if (itemId === 'thugs') return THUG_HIRE_PRICE;
  return catalog.find((entry) => entry.itemId === itemId)?.unitPrice ?? 0;
}

export function resolveCatalogDisplayName(
  itemId: ShopCartLineKey,
  catalog: SupplyOrderCatalogPrice[],
): string {
  if (itemId === 'thugs') return TERMS.enforcers;
  return catalog.find((entry) => entry.itemId === itemId)?.displayName ?? itemId;
}

/** MAX resolves to a concrete quantity using cash minus other cart lines. */
export function maxAffordableForOrderLine(
  cash: number,
  lines: SupplyOrderLine[],
  itemId: ShopCartLineKey,
  unitPrice: number,
): number {
  const otherCost = estimateSupplyOrderTotal(lines.filter((line) => line.itemId !== itemId));
  const remainingCash = Math.max(0, cash - otherCost);
  const affordable = maxAffordableQuantity(remainingCash, unitPrice);
  return Math.min(affordable, SHOP_MAX_SINGLE_PURCHASE_QUANTITY);
}

export function buildCatalogPrices(
  catalog: Array<{ key: string; displayName: string; unitPrice: number }>,
): SupplyOrderCatalogPrice[] {
  return [
    ...catalog.map((entry) => ({
      itemId: entry.key as ShopCartLineKey,
      unitPrice: entry.unitPrice,
      displayName: entry.displayName,
    })),
    { itemId: 'thugs' as const, unitPrice: THUG_HIRE_PRICE, displayName: TERMS.enforcers },
  ];
}

export function formatSupplyOrderSummary(lines: SupplyOrderLine[], catalog: SupplyOrderCatalogPrice[]) {
  const merged = mergeSupplyOrderLines(lines);
  return merged.map((line) => {
    const resolved = resolveShopCartLine(line.itemId, line.quantity);
    return {
      itemId: line.itemId,
      displayName: resolveCatalogDisplayName(line.itemId, catalog),
      quantity: line.quantity,
      unitPrice: resolved.unitPrice,
      lineTotal: resolved.lineCost,
    };
  });
}

export type { ShopCartLineInput, ShopCartLineKey };
