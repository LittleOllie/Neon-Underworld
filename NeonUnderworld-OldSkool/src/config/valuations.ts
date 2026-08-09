/**
 * Canonical OldSkool asset valuations — aligned with Redlite guide §5.
 * Net worth is always derived from these values; never stored on the player.
 *
 * Included: cash, bankCash, thugs, workers, vehicles, drugs
 * Excluded (Redlite): weapons, beer, condoms, brothels, coffee shops
 *
 * Neon improvement: bankCash counts toward net worth (Redlite had no bank).
 */
export const NET_WORTH_VALUATIONS = {
  cash: 1,
  bankCash: 1,
  thug: 700,
  worker: 1750,
  vehicle: 2000,
  drugUnit: 5,
} as const;

export type NetWorthValuationKey = keyof typeof NET_WORTH_VALUATIONS;

/** Display-only — brothels/shops excluded from rankings per Redlite */
export const BUSINESS_DISPLAY_VALUE = 5000;

export interface NetWorthInput {
  cash: number;
  bankCash: number;
  thugs: number;
  workers: number;
  vehicles: number;
  drugs: number;
  /** Ignored for net worth — kept for empire display */
  businesses?: number;
}

/** Display value for owned businesses (not ranked) */
export function businessDisplayValue(businessCount: number): number {
  return businessCount * BUSINESS_DISPLAY_VALUE;
}

/**
 * Canonical OldSkool net-worth formula.
 * Businesses/brothels/shops do NOT increase rank (Redlite §5).
 */
export function calculateCanonicalNetWorth(input: NetWorthInput): number {
  let total = 0;
  total += input.cash * NET_WORTH_VALUATIONS.cash;
  total += input.bankCash * NET_WORTH_VALUATIONS.bankCash;
  total += input.thugs * NET_WORTH_VALUATIONS.thug;
  total += input.workers * NET_WORTH_VALUATIONS.worker;
  total += input.vehicles * NET_WORTH_VALUATIONS.vehicle;
  total += input.drugs * NET_WORTH_VALUATIONS.drugUnit;
  return Math.floor(total);
}

/** @deprecated Use businessDisplayValue — businesses excluded from NW */
export function businessNetWorth(businessCount: number): number {
  return businessDisplayValue(businessCount);
}
