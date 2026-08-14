import { ATTACK_RULES } from '@/config/game/attack-rules';
import { CANONICAL_NET_WORTH_VALUATIONS } from '@/lib/game-engine/canonical-net-worth';
import { createCombatRng } from './combat-random';
import { deriveIntelSeed } from './build-intel-snapshot';
import { allocateWeaponsForThugs, type WeaponAllocation } from './weapon-allocation';
import {
  nwRelativeExposureBand,
  deepWeaponReadinessBand,
  workforceStabilityBand,
  type ExposureBand6,
  type DeepWeaponBand,
  type WorkforceStabilityBand,
} from './intel-bands';
import { calculateProstituteHappiness } from '@/lib/game-engine/happiness';
import { workforceProtectionBand, type WorkforceProtectionBand, type PoachingOutlook } from '@/config/game/worker-poaching-rules';
import { computePoachingOutlook } from './poach-outlook';

export interface DeepIntelSourcePlayer {
  id: string;
  alias: string;
  districtName: string;
  thugs: number;
  prostitutes: number;
  glocks: number;
  uzis: number;
  aks: number;
  cash: number;
  hash: number;
  shrooms: number;
  coke: number;
  heroin: number;
  cartelId: string | null;
  canonicalNetWorth: number;
  condoms: number;
  prostitutePayoutPercent: number;
  /** Optional cartel virtual thugs for protection band (not exposed in snapshot). */
  cartelSupportThugs?: number;
  /** Optional organised cartel Response Force thugs (capped, not full pool). */
  cartelResponseForceThugs?: number;
}

/** Client-safe deep intel payload — no exact secret crew or cash values. */
export interface DeepIntelSnapshot {
  targetPlayerId: string;
  targetAlias: string;
  targetCity: string;
  scoutedAt: string;
  expiresAt: string;
  canonicalNetWorthAtScout: number;
  estimatedThugMin: number;
  estimatedThugMax: number;
  estimatedWorkerMin: number;
  estimatedWorkerMax: number;
  cashExposureBand: ExposureBand6;
  drugExposureBand: ExposureBand6;
  weaponReadinessBand: DeepWeaponBand;
  cartelPresence: string | null;
  workforceStabilityBand: WorkforceStabilityBand;
  workforceProtectionBand: WorkforceProtectionBand;
  poachingOutlook: PoachingOutlook;
}

export interface CountEstimateRange {
  min: number;
  max: number;
}

/** Deterministic ±15–20% estimate range for a secret count. */
export function estimateCountRange(actual: number, rng: { next: () => number }): CountEstimateRange {
  if (actual <= 0) {
    return { min: 0, max: 0 };
  }
  const lowerPct = 0.8 + rng.next() * 0.05;
  const upperPct = 1.15 + rng.next() * 0.05;
  const min = Math.max(0, Math.floor(actual * lowerPct));
  const max = Math.max(min, Math.ceil(actual * upperPct));
  return { min, max };
}

export function attackableCashExposureRatio(cash: number, canonicalNetWorth: number): number {
  if (canonicalNetWorth <= 0) {
    return cash > 0 ? 1 : 0;
  }
  return cash / canonicalNetWorth;
}

export function drugNetWorthExposureRatio(
  drugs: { hash: number; shrooms: number; coke: number; heroin: number },
  canonicalNetWorth: number,
): number {
  const totalUnits = drugs.hash + drugs.shrooms + drugs.coke + drugs.heroin;
  const drugNw = totalUnits * CANONICAL_NET_WORTH_VALUATIONS.drugUnit;
  if (canonicalNetWorth <= 0) {
    return drugNw > 0 ? 1 : 0;
  }
  return drugNw / canonicalNetWorth;
}

export function cartelPresenceLabel(cartelId: string | null): string | null {
  if (!cartelId) return null;
  if (ATTACK_RULES.cartelDefenceActive) return 'Strong Cartel Presence';
  return 'Cartel Member';
}

export function buildDeepIntelSnapshot(
  target: DeepIntelSourcePlayer,
  scoutPlayerId: string,
  idempotencyKey: string,
  scoutedAt = new Date(),
): DeepIntelSnapshot {
  const seed = deriveIntelSeed(scoutPlayerId, target.id, `deep:${idempotencyKey}`);
  const rng = createCombatRng(seed);

  const thugRange = estimateCountRange(target.thugs, rng);
  const workerRange = estimateCountRange(target.prostitutes, rng);

  const alloc = allocateWeaponsForThugs(target.thugs, {
    glocks: target.glocks,
    uzis: target.uzis,
    aks: target.aks,
  });

  const cashRatio = attackableCashExposureRatio(target.cash, target.canonicalNetWorth);
  const drugRatio = drugNetWorthExposureRatio(
    {
      hash: target.hash,
      shrooms: target.shrooms,
      coke: target.coke,
      heroin: target.heroin,
    },
    target.canonicalNetWorth,
  );

  const expiresAt = new Date(
    scoutedAt.getTime() + ATTACK_RULES.scoutReportExpiryHours * 60 * 60 * 1000,
  );

  const happiness = calculateProstituteHappiness({
    prostitutes: target.prostitutes,
    thugs: target.thugs,
    hash: target.hash,
    condoms: target.condoms,
    prostitutePayoutPercent: target.prostitutePayoutPercent,
  });

  const thugsForProtection =
    target.thugs +
    Math.max(0, target.cartelSupportThugs ?? 0) +
    Math.max(0, target.cartelResponseForceThugs ?? 0);
  let protectionBand = workforceProtectionBand(thugsForProtection, target.prostitutes);
  if (target.cartelId && ATTACK_RULES.cartelDefenceActive && protectionBand !== 'Strong') {
    const order: WorkforceProtectionBand[] = [
      'Very Weak',
      'Weak',
      'Moderate',
      'Good',
      'Strong',
    ];
    const idx = order.indexOf(protectionBand);
    if (idx >= 0 && idx < order.length - 1) {
      protectionBand = order[idx + 1]!;
    }
  }

  const stabilityBand = workforceStabilityBand(happiness.score);
  const cartelPresence = cartelPresenceLabel(target.cartelId);

  const poachingOutlook = computePoachingOutlook({
    workforceStabilityBand: stabilityBand,
    workforceProtectionBand: protectionBand,
    weaponReadinessBand: deepWeaponReadinessBand(target.thugs, alloc),
    cartelPresence,
  });

  return {
    targetPlayerId: target.id,
    targetAlias: target.alias,
    targetCity: target.districtName,
    scoutedAt: scoutedAt.toISOString(),
    expiresAt: expiresAt.toISOString(),
    canonicalNetWorthAtScout: target.canonicalNetWorth,
    estimatedThugMin: thugRange.min,
    estimatedThugMax: thugRange.max,
    estimatedWorkerMin: workerRange.min,
    estimatedWorkerMax: workerRange.max,
    cashExposureBand: nwRelativeExposureBand(cashRatio),
    drugExposureBand: nwRelativeExposureBand(drugRatio),
    weaponReadinessBand: deepWeaponReadinessBand(target.thugs, alloc),
    cartelPresence,
    workforceStabilityBand: stabilityBand,
    workforceProtectionBand: protectionBand,
    poachingOutlook,
  };
}

/** Format a count range for display (e.g. "850–1,150"). */
export function formatCountEstimateRange(min: number, max: number): string {
  if (min === max) return min.toLocaleString();
  return `${min.toLocaleString()}–${max.toLocaleString()}`;
}

export function weaponAllocationForIntel(thugs: number, inventory: {
  glocks: number;
  uzis: number;
  aks: number;
}): WeaponAllocation {
  return allocateWeaponsForThugs(thugs, inventory);
}
