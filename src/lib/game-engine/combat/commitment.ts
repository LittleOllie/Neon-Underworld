import { ATTACK_RULES, type AttackType } from '@/config/game/attack-rules';

/** Scalable attack commitment — percentage of owned army with per-type caps. */
export const COMBAT_COMMITMENT_RULES: Record<
  AttackType,
  { minimumCommit: number; armyFraction: number; absoluteCap: number }
> = {
  DRIVE_BY: {
    minimumCommit: 100,
    armyFraction: 0.08,
    absoluteCap: 8_000,
  },
  HOME_INVASION: {
    minimumCommit: 250,
    armyFraction: 0.16,
    absoluteCap: 15_000,
  },
  RAID_DRUG_LABS: {
    minimumCommit: 300,
    armyFraction: 0.2,
    absoluteCap: 18_000,
  },
  POACH_WORKERS: {
    minimumCommit: 150,
    armyFraction: 0.12,
    absoluteCap: 12_000,
  },
};

/** Absolute safety ceiling for a single attack request (schema + server guard). */
export const COMBAT_ABSOLUTE_MAX_COMMIT = 25_000;

/**
 * Maximum thugs the attacker may commit for this attack type given army size.
 * Player may send less; eligibility rejects above this.
 */
export function maxCommitmentForAttack(attackType: AttackType, ownedThugs: number): number {
  const owned = Math.max(0, Math.floor(ownedThugs));
  if (owned <= 0) return 0;

  const rule = COMBAT_COMMITMENT_RULES[attackType];
  const fromFraction = Math.floor(owned * rule.armyFraction);
  const scaled = Math.max(rule.minimumCommit, fromFraction);

  return Math.min(
    scaled,
    rule.absoluteCap,
    owned,
    COMBAT_ABSOLUTE_MAX_COMMIT,
    ATTACK_RULES.maxAttackingThugs,
  );
}

/** Suggested default commit for attack UI — moderate fraction of max. */
export function suggestedCommitmentForAttack(attackType: AttackType, ownedThugs: number): number {
  const max = maxCommitmentForAttack(attackType, ownedThugs);
  if (max <= 0) return 0;
  if (max <= 50) return max;
  return Math.max(ATTACK_RULES.minAttackingThugs, Math.floor(max * 0.25));
}
