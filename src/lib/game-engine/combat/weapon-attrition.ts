import { COMBAT_WEAPON_ATTRITION } from '@/config/game/combat-attrition';
import type { WeaponAllocation } from './weapon-allocation';

export interface WeaponLosses {
  glocks: number;
  uzis: number;
  aks: number;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

/**
 * Lose weapons proportional to thug casualties among committed allocation.
 * Weakest-first (glocks → uzis → aks) — replacement demand without wiping arsenals.
 */
export function resolveWeaponAttrition(
  casualties: number,
  allocation: WeaponAllocation,
  rng: { next(): number },
): WeaponLosses {
  if (casualties <= 0 || allocation.armedThugs <= 0) {
    return { glocks: 0, uzis: 0, aks: 0 };
  }

  const committed = allocation.glocks + allocation.uzis + allocation.aks;
  if (committed <= 0) return { glocks: 0, uzis: 0, aks: 0 };

  const jitter = 0.85 + rng.next() * 0.3;
  const raw = Math.round(casualties * COMBAT_WEAPON_ATTRITION.lossRatePerCasualty * jitter);
  const cap = Math.max(
    COMBAT_WEAPON_ATTRITION.minLossOnCasualties,
    Math.floor(committed * COMBAT_WEAPON_ATTRITION.maxLossFractionOfCommitted),
  );
  let toLose = clamp(raw, COMBAT_WEAPON_ATTRITION.minLossOnCasualties, Math.min(cap, committed));

  const losses: WeaponLosses = { glocks: 0, uzis: 0, aks: 0 };
  const order: (keyof WeaponLosses)[] = ['glocks', 'uzis', 'aks'];

  for (const key of order) {
    if (toLose <= 0) break;
    const available = allocation[key];
    const take = Math.min(available, toLose);
    losses[key] = take;
    toLose -= take;
  }

  return losses;
}
