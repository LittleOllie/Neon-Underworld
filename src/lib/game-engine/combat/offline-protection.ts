import type { CombatResolutionResult } from '@/lib/game-engine/combat/resolve-combat';
import type { DrugStock } from '@/lib/game-engine/combat/theft';
import {
  OFFLINE_ATTACK_LIMIT_STANDARD,
  OFFLINE_PROTECTION_RESET_ONLINE_MS,
  isPlayerOffline,
} from '@/config/game/offline-protection';

export function totalDrugsStolen(drugs: DrugStock): number {
  return drugs.hash + drugs.shrooms + drugs.coke + drugs.heroin;
}

/** Meaningful defender loss — counts toward offline protection. */
export function isDamagingAttackResult(combat: Pick<
  CombatResolutionResult,
  'defenderLosses' | 'cartelThugLosses' | 'cashStolen' | 'drugsStolen' | 'workersStolen'
>): boolean {
  return (
    combat.defenderLosses > 0 ||
    combat.cartelThugLosses > 0 ||
    combat.cashStolen > 0 ||
    totalDrugsStolen(combat.drugsStolen) > 0 ||
    (combat.workersStolen ?? 0) > 0
  );
}

export interface OfflineProtectionState {
  offlineDamagingHits: number;
  offlineProtectionActive: boolean;
  lastSeenAt: Date | null;
  onlineSessionStartedAt?: Date | null;
}

export function resolveOnlineSessionStart(
  lastSeenAt: Date | null | undefined,
  previousSessionStart: Date | null | undefined,
  atMs = Date.now(),
): Date {
  if (isPlayerOffline(lastSeenAt, atMs)) {
    return new Date(atMs);
  }
  return previousSessionStart ?? new Date(atMs);
}

export function shouldResetOfflineProtectionCycle(
  state: Pick<
    OfflineProtectionState,
    'onlineSessionStartedAt' | 'offlineDamagingHits' | 'offlineProtectionActive' | 'lastSeenAt'
  >,
  atMs = Date.now(),
): boolean {
  if (state.offlineDamagingHits <= 0 && !state.offlineProtectionActive) {
    return false;
  }
  if (isPlayerOffline(state.lastSeenAt, atMs)) {
    return false;
  }
  if (!state.onlineSessionStartedAt) {
    return false;
  }
  return atMs - state.onlineSessionStartedAt.getTime() >= OFFLINE_PROTECTION_RESET_ONLINE_MS;
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
