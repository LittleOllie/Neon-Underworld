import { ATTACK_RULES } from '@/config/game/attack-rules';
import type { CombatRng } from './combat-random';
import { varianceMultiplier } from './combat-random';

export type ForceEstimate =
  | 'Overwhelming Advantage'
  | 'Advantage'
  | 'Even Match'
  | 'Disadvantage'
  | 'Severe Disadvantage';

export function forceEstimate(attackerStrength: number, defenderStrength: number): ForceEstimate {
  if (defenderStrength <= 0 && attackerStrength > 0) return 'Overwhelming Advantage';
  if (attackerStrength <= 0) return 'Severe Disadvantage';
  const ratio = attackerStrength / defenderStrength;
  if (ratio >= 2) return 'Overwhelming Advantage';
  if (ratio >= 1.25) return 'Advantage';
  if (ratio >= 0.8) return 'Even Match';
  if (ratio >= 0.5) return 'Disadvantage';
  return 'Severe Disadvantage';
}

export function resolveForceScores(
  attackerBaseStrength: number,
  defenderBaseStrength: number,
  rng: CombatRng,
): { attackerEffective: number; defenderEffective: number; ratio: number } {
  const { randomVarianceMin, randomVarianceMax } = ATTACK_RULES;
  const attackerEffective =
    attackerBaseStrength * varianceMultiplier(rng, randomVarianceMin, randomVarianceMax);
  const defenderEffective =
    defenderBaseStrength * varianceMultiplier(rng, randomVarianceMin, randomVarianceMax);
  const ratio =
    defenderEffective <= 0
      ? attackerEffective > 0
        ? 999
        : 1
      : attackerEffective / defenderEffective;
  return { attackerEffective, defenderEffective, ratio };
}
