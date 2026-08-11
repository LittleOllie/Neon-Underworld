import type { CombatResolutionResult } from '@/lib/game-engine/combat/resolve-combat';
import type { DrugStock } from '@/lib/game-engine/combat/theft';
import {
  OFFLINE_ATTACK_LIMIT_STANDARD,
  isPlayerOffline,
} from '@/config/game/offline-protection';

export function totalDrugsStolen(drugs: DrugStock): number {
  return drugs.hash + drugs.shrooms + drugs.coke + drugs.heroin;
}

/** Meaningful defender loss — counts toward offline protection. */
export function isDamagingAttackResult(combat: Pick<
  CombatResolutionResult,
  'defenderLosses' | 'cartelThugLosses' | 'cashStolen' | 'drugsStolen'
>): boolean {
  return (
    combat.defenderLosses > 0 ||
    combat.cartelThugLosses > 0 ||
    combat.cashStolen > 0 ||
    totalDrugsStolen(combat.drugsStolen) > 0
  );
}

export interface OfflineProtectionState {
  offlineDamagingHits: number;
  offlineProtectionActive: boolean;
  lastSeenAt: Date | null;
}

export function shouldBlockOfflineProtectedDefender(
  state: OfflineProtectionState,
  now = Date.now(),
): boolean {
  if (!state.offlineProtectionActive) return false;
  return isPlayerOffline(state.lastSeenAt, now);
}

export function nextOfflineHitCount(
  currentHits: number,
  damaging: boolean,
  defenderWasOffline: boolean,
): { hits: number; protectionActive: boolean } {
  if (!defenderWasOffline || !damaging) {
    return {
      hits: currentHits,
      protectionActive: currentHits >= OFFLINE_ATTACK_LIMIT_STANDARD,
    };
  }
  const hits = currentHits + 1;
  return {
    hits,
    protectionActive: hits >= OFFLINE_ATTACK_LIMIT_STANDARD,
  };
}
