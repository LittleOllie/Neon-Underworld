import { getCityShopItem, type ShopItemKey } from '@core/config/game/shop-rules';
import { maxAffordableQuantity, shopPreviewTotal } from '@local/lib/numeric-input';
import type { WireCommand } from './types';

export interface WirePurchasePreview {
  itemKey: ShopItemKey;
  displayName: string;
  quantity: number;
  unitPrice: number;
  totalCost: number;
  currentCash: number;
  remainingCash: number;
  affordable: boolean;
}

export type WirePurchasePreviewResult =
  | { ok: true; preview: WirePurchasePreview }
  | { ok: false; reason: 'unknown_item' | 'zero_max' | 'insufficient'; message: string; maxAffordable?: number; displayName?: string; unitPrice?: number };

export function buildWirePurchasePreview(
  command: Extract<WireCommand, { kind: 'BUY' }>,
  cash: number,
): WirePurchasePreviewResult {
  const item = getCityShopItem(command.itemKey);
  if (!item) {
    return { ok: false, reason: 'unknown_item', message: 'Unknown shop item.' };
  }

  const unitPrice = item.shopPrice;
  const safeCash = Number.isFinite(cash) && cash >= 0 ? cash : 0;

  let quantity: number;
  if (command.mode === 'max') {
    quantity = maxAffordableQuantity(safeCash, unitPrice);
    if (quantity <= 0) {
      return {
        ok: false,
        reason: 'zero_max',
        message: `Insufficient cash for ${item.displayName}.`,
        displayName: item.displayName,
        unitPrice,
      };
    }
  } else {
    quantity = command.quantity;
  }

  const totalCost = shopPreviewTotal(unitPrice, quantity);
  const affordable = totalCost <= safeCash;
  const remainingCash = safeCash - totalCost;

  if (!affordable) {
    const maxAffordable = maxAffordableQuantity(safeCash, unitPrice);
    return {
      ok: false,
      reason: 'insufficient',
      message: `Insufficient cash for ${quantity.toLocaleString()} × ${item.displayName}.`,
      maxAffordable,
      displayName: item.displayName,
      unitPrice,
    };
  }

  return {
    ok: true,
    preview: {
      itemKey: command.itemKey,
      displayName: item.displayName,
      quantity,
      unitPrice,
      totalCost,
      currentCash: safeCash,
      remainingCash,
      affordable: true,
    },
  };
}
