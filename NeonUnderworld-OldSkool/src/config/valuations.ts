/**
 * Canonical OldSkool asset valuations — aligned with Redlite guide §5.
 * Implementation lives in core engine; re-exported here for OldSkool imports and scripts.
 */
export {
  CANONICAL_NET_WORTH_VALUATIONS as NET_WORTH_VALUATIONS,
  calculateCanonicalNetWorth,
  type CanonicalNetWorthInput as NetWorthInput,
} from '../../../src/lib/game-engine/canonical-net-worth';

export type NetWorthValuationKey = keyof typeof import('../../../src/lib/game-engine/canonical-net-worth').CANONICAL_NET_WORTH_VALUATIONS;

/** Display-only — brothels/shops excluded from rankings per Redlite */
export const BUSINESS_DISPLAY_VALUE = 5000;

/** Display value for owned businesses (not ranked) */
export function businessDisplayValue(businessCount: number): number {
  return businessCount * BUSINESS_DISPLAY_VALUE;
}

/** @deprecated Use businessDisplayValue — businesses excluded from NW */
export function businessNetWorth(businessCount: number): number {
  return businessDisplayValue(businessCount);
}
