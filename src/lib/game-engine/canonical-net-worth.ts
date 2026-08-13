/**
 * Canonical Neon Underworld net-worth formula (OldSkool / rankings / combat eligibility).
 *
 * Source of truth for all player-visible and gameplay-sensitive net worth.
 * Aligned with Redlite guide §5 + Neon bankCash inclusion.
 *
 * Included: cash, bankCash, thugs, workers, vehicles, drugs
 * Excluded: weapons, beer, condoms, brothels, coffee shops
 */

export const CANONICAL_NET_WORTH_VALUATIONS = {
  cash: 1,
  bankCash: 1,
  thug: 700,
  worker: 1750,
  vehicle: 2000,
  drugUnit: 5,
} as const;

export interface CanonicalNetWorthInput {
  cash: number;
  bankCash: number;
  thugs: number;
  workers: number;
  vehicles: number;
  drugs: number;
  /** 50% of business purchase prices — Street NW insulation layer */
  businessStreetAssets?: number;
  /** Ignored for net worth — kept for empire display compatibility */
  businesses?: number;
}

export interface CanonicalNetWorthPlayerRecord {
  cash: number;
  bankCash: number;
  thugs: number;
  prostitutes: number;
  rides: number;
  hash: number;
  shrooms: number;
  coke: number;
  heroin: number;
}

/** Canonical net-worth formula — use this for rankings, header, attack range, and profiles. */
export function calculateCanonicalNetWorth(input: CanonicalNetWorthInput): number {
  let total = 0;
  total += input.cash * CANONICAL_NET_WORTH_VALUATIONS.cash;
  total += input.bankCash * CANONICAL_NET_WORTH_VALUATIONS.bankCash;
  total += input.thugs * CANONICAL_NET_WORTH_VALUATIONS.thug;
  total += input.workers * CANONICAL_NET_WORTH_VALUATIONS.worker;
  total += input.vehicles * CANONICAL_NET_WORTH_VALUATIONS.vehicle;
  total += input.drugs * CANONICAL_NET_WORTH_VALUATIONS.drugUnit;
  total += input.businessStreetAssets ?? 0;
  return Math.floor(total);
}

export interface CanonicalNetWorthBusinessContext {
  /** Street-available workers (Player.prostitutes). */
  streetWorkers: number;
  /** Sum of workers assigned to businesses. */
  assignedWorkers: number;
  /** Sum of floor(purchasePrice * 0.5) for owned businesses. */
  businessStreetAssets: number;
}

export function totalOwnedWorkers(ctx: Pick<CanonicalNetWorthBusinessContext, 'streetWorkers' | 'assignedWorkers'>): number {
  return ctx.streetWorkers + ctx.assignedWorkers;
}

export function calculateCanonicalNetWorthFromPlayer(
  player: CanonicalNetWorthPlayerRecord,
  businessContext?: CanonicalNetWorthBusinessContext,
): number {
  const streetWorkers = businessContext?.streetWorkers ?? player.prostitutes;
  const assignedWorkers = businessContext?.assignedWorkers ?? 0;
  return calculateCanonicalNetWorth({
    cash: player.cash,
    bankCash: player.bankCash,
    thugs: player.thugs,
    workers: streetWorkers + assignedWorkers,
    vehicles: player.rides,
    drugs: player.hash + player.shrooms + player.coke + player.heroin,
    businessStreetAssets: businessContext?.businessStreetAssets ?? 0,
  });
}

/** @deprecated Prefer calculateCanonicalNetWorthFromPlayer with businessContext when businesses exist. */
export function calculateCanonicalNetWorthFromPlayerLegacy(player: CanonicalNetWorthPlayerRecord): number {
  return calculateCanonicalNetWorthFromPlayer(player);
}
