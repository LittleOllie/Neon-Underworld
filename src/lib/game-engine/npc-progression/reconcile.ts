import { NPC_PROGRESSION_RECOVERY_RATE } from '@/config/game/npc-progression-rules';
import { effectiveRecoveryRate } from '@/lib/game-engine/npc-progression/round-age';
import type { NpcTargetAssetState } from '@/lib/game-engine/npc-progression/target-state';

/** Move current toward target without shrinking — PvP losses persist until gradual recovery. */
export function reconcileScalar(current: number, target: number, recoveryRate: number): number {
  const cur = Math.max(0, Math.floor(current));
  const tgt = Math.max(0, Math.floor(target));
  if (cur >= tgt) return cur;
  return Math.floor(cur + (tgt - cur) * recoveryRate);
}

export function reconcileTowardTarget(
  current: NpcTargetAssetState,
  target: NpcTargetAssetState,
  recoveryRate: number = NPC_PROGRESSION_RECOVERY_RATE,
): NpcTargetAssetState {
  return {
    cash: reconcileScalar(current.cash, target.cash, recoveryRate),
    bankCash: reconcileScalar(current.bankCash, target.bankCash, recoveryRate),
    prostitutes: reconcileScalar(current.prostitutes, target.prostitutes, recoveryRate),
    thugs: reconcileScalar(current.thugs, target.thugs, recoveryRate),
    rides: reconcileScalar(current.rides, target.rides, recoveryRate),
    glocks: reconcileScalar(current.glocks, target.glocks, recoveryRate),
    uzis: reconcileScalar(current.uzis, target.uzis, recoveryRate),
    aks: reconcileScalar(current.aks, target.aks, recoveryRate),
    beer: reconcileScalar(current.beer, target.beer, recoveryRate),
    condoms: reconcileScalar(current.condoms, target.condoms, recoveryRate),
    hash: reconcileScalar(current.hash, target.hash, recoveryRate),
    shrooms: reconcileScalar(current.shrooms, target.shrooms, recoveryRate),
    coke: reconcileScalar(current.coke, target.coke, recoveryRate),
    heroin: reconcileScalar(current.heroin, target.heroin, recoveryRate),
    businesses: reconcileBusinesses(current.businesses, target.businesses, recoveryRate),
  };
}

export function reconcileBusinessesTowardTarget(
  current: NpcTargetAssetState['businesses'],
  target: NpcTargetAssetState['businesses'],
  recoveryRate: number,
): NpcTargetAssetState['businesses'] {
  return reconcileBusinesses(current, target, recoveryRate);
}

function reconcileBusinesses(
  current: NpcTargetAssetState['businesses'],
  target: NpcTargetAssetState['businesses'],
  recoveryRate: number,
): NpcTargetAssetState['businesses'] {
  const result: NpcTargetAssetState['businesses'] = [];
  const maxLen = Math.max(current.length, target.length);
  for (let i = 0; i < maxLen; i++) {
    const c = current[i];
    const t = target[i];
    if (!t) continue;
    if (!c) {
      result.push({ ...t, level: 1, assignedWorkers: 0, assignedThugs: 0 });
      continue;
    }
    result.push({
      businessType: t.businessType,
      level: reconcileScalar(c.level, t.level, recoveryRate),
      assignedWorkers: reconcileScalar(c.assignedWorkers, t.assignedWorkers, recoveryRate),
      assignedThugs: reconcileScalar(c.assignedThugs, t.assignedThugs, recoveryRate),
    });
  }
  return result;
}

export function compoundRecoveryRate(daysElapsed: number): number {
  return effectiveRecoveryRate(daysElapsed, NPC_PROGRESSION_RECOVERY_RATE);
}

export function playerAssetsFromRecord(player: {
  cash: number;
  bankCash: number;
  prostitutes: number;
  thugs: number;
  rides: number;
  glocks: number;
  uzis: number;
  aks: number;
  beer: number;
  condoms: number;
  hash: number;
  shrooms: number;
  coke: number;
  heroin: number;
}): NpcTargetAssetState {
  return {
    cash: player.cash,
    bankCash: player.bankCash,
    prostitutes: player.prostitutes,
    thugs: player.thugs,
    rides: player.rides,
    glocks: player.glocks,
    uzis: player.uzis,
    aks: player.aks,
    beer: player.beer,
    condoms: player.condoms,
    hash: player.hash,
    shrooms: player.shrooms,
    coke: player.coke,
    heroin: player.heroin,
    businesses: [],
  };
}

export function businessesFromRecords(
  rows: Array<{
    businessType: NpcTargetAssetState['businesses'][0]['businessType'];
    level: number;
    assignedWorkers: number;
    assignedThugs: number;
  }>,
): NpcTargetAssetState['businesses'] {
  return rows.map((r) => ({
    businessType: r.businessType,
    level: r.level,
    assignedWorkers: r.assignedWorkers,
    assignedThugs: r.assignedThugs,
  }));
}
