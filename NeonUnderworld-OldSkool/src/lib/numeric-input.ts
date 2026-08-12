/** Shared integer parsing/validation for turn spend and shop quantity inputs. */

import { SHOP_MAX_QUANTITY_PER_REQUEST } from '@core/config/game/shop-rules';

export function parsePositiveInteger(raw: string): number | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  if (!/^\d+$/.test(trimmed)) return null;
  const n = Number(trimmed);
  if (!Number.isSafeInteger(n) || n < 1) return null;
  return n;
}

export function validateTurnAmount(amount: number | null, available: number): string | null {
  if (amount === null) return 'Enter at least 1 turn.';
  if (amount > available) {
    return `You only have ${available.toLocaleString()} turns.`;
  }
  return null;
}

export function validateQuantity(amount: number | null): string | null {
  if (amount === null) return 'Enter a valid quantity.';
  if (amount > SHOP_MAX_QUANTITY_PER_REQUEST) {
    return `Maximum ${SHOP_MAX_QUANTITY_PER_REQUEST.toLocaleString()} units per transaction.`;
  }
  return null;
}

export function shopPreviewTotal(unitPrice: number, quantity: number): number {
  return unitPrice * quantity;
}

export function shopInventoryKey(
  itemKey: string,
): keyof import('@local/server/actions/shop.actions').ShopPageData['inventory'] | null {
  const map: Record<string, keyof import('@local/server/actions/shop.actions').ShopPageData['inventory']> = {
    glock: 'glocks',
    uzi: 'uzis',
    ak: 'aks',
    ride: 'rides',
    condom: 'condoms',
    beer: 'beer',
    hash: 'hash',
    shroom: 'shrooms',
    coke: 'coke',
    heroin: 'heroin',
  };
  return map[itemKey] ?? null;
}
