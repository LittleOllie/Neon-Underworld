import type { CombatRng } from './combat-random';

export interface CasualtyResult {
  attackerLosses: number;
  defenderLosses: number;
  attackerVictory: boolean;
  tacticalSuccess: boolean;
}

/** Casualties scale with force ratio; both sides may lose thugs. */
export function resolveCasualties(
  attackingThugs: number,
  defendingThugs: number,
  forceRatio: number,
  rng: CombatRng,
): CasualtyResult {
  const attackerVictory = forceRatio >= 1;
  const tacticalSuccess = forceRatio >= 0.75;

  const clamp = (n: number, max: number) => Math.max(0, Math.min(max, Math.floor(n)));

  let defenderLossRate: number;
  let attackerLossRate: number;

  if (forceRatio >= 2) {
    defenderLossRate = 0.45 + rng.next() * 0.25;
    attackerLossRate = 0.05 + rng.next() * 0.1;
  } else if (forceRatio >= 1.25) {
    defenderLossRate = 0.3 + rng.next() * 0.2;
    attackerLossRate = 0.08 + rng.next() * 0.12;
  } else if (forceRatio >= 1) {
    defenderLossRate = 0.2 + rng.next() * 0.15;
    attackerLossRate = 0.12 + rng.next() * 0.15;
  } else if (forceRatio >= 0.7) {
    defenderLossRate = 0.1 + rng.next() * 0.12;
    attackerLossRate = 0.2 + rng.next() * 0.2;
  } else {
    defenderLossRate = 0.05 + rng.next() * 0.1;
    attackerLossRate = 0.35 + rng.next() * 0.3;
  }

  return {
    attackerLosses: clamp(attackingThugs * attackerLossRate, attackingThugs),
    defenderLosses: clamp(defendingThugs * defenderLossRate, defendingThugs),
    attackerVictory,
    tacticalSuccess,
  };
}
