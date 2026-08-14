/** Shared integer parsing/validation for turn spend and shop quantity inputs. */

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
  return null;
}

export function shopPreviewTotal(unitPrice: number, quantity: number): number {
  return unitPrice * quantity;
}

/** Preview-only max affordable quantity — server Shop action remains authoritative. */
export function maxAffordableQuantity(cash: number, unitPrice: number): number {
  if (!Number.isFinite(cash) || !Number.isFinite(unitPrice) || cash < 0 || unitPrice <= 0) {
    return 0;
  }
  if (!Number.isSafeInteger(cash)) {
    return 0;
  }
  return Math.floor(cash / unitPrice);
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
