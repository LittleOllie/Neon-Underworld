import { ATTACK_RULES } from '@/config/game/attack-rules';
import type { PlayerIntelSnapshot } from './eligibility';
import { allocateWeaponsForThugs } from './weapon-allocation';
import { createCombatRng } from './combat-random';

export interface IntelSourcePlayer {
  id: string;
  alias: string;
  districtName: string;
  thugs: number;
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
}

/** Build scout intel with controlled estimate noise (stored internally, bands shown in UI). */
export function buildPlayerIntelSnapshot(
  target: IntelSourcePlayer,
  seed: number,
  scoutedAt = new Date(),
): PlayerIntelSnapshot {
  const rng = createCombatRng(seed);
  const noise = () => 0.85 + rng.next() * 0.3;

  const alloc = allocateWeaponsForThugs(target.thugs, {
    glocks: target.glocks,
    uzis: target.uzis,
    aks: target.aks,
  });

  const totalDrugs = target.hash + target.shrooms + target.coke + target.heroin;

  const expiresAt = new Date(
    scoutedAt.getTime() + ATTACK_RULES.scoutReportExpiryHours * 60 * 60 * 1000,
  );

  return {
    targetPlayerId: target.id,
    targetAlias: target.alias,
    targetCity: target.districtName,
    scoutedAt: scoutedAt.toISOString(),
    expiresAt: expiresAt.toISOString(),
    confidencePercent: 72 + Math.floor(rng.next() * 21),
    canonicalNetWorthAtScout: target.canonicalNetWorth,
    estimatedThugs: Math.max(1, Math.floor(target.thugs * noise())),
    estimatedWeaponStrength: Math.max(1, Math.floor(alloc.totalStrength * noise())),
    estimatedCash: Math.max(0, Math.floor(target.cash * noise())),
    estimatedDrugs: Math.max(0, Math.floor(totalDrugs * noise())),
    cartelId: target.cartelId,
  };
}

export function deriveIntelSeed(scoutPlayerId: string, targetPlayerId: string, idempotencyKey: string): number {
  let h = 0;
  const s = `${scoutPlayerId}:${targetPlayerId}:${idempotencyKey}`;
  for (let i = 0; i < s.length; i++) {
    h = (Math.imul(31, h) + s.charCodeAt(i)) | 0;
  }
  return h >>> 0;
}
