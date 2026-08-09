import { isWithinAttackRange } from '@/config/game/redlite-rules';
import { ATTACK_RULES, type AttackType } from '@/config/game/attack-rules';
import { ridesRequiredForThugs } from '@/lib/game-engine/combat-rules';

export interface PlayerIntelSnapshot {
  targetPlayerId: string;
  targetAlias: string;
  targetCity: string;
  scoutedAt: string;
  expiresAt: string;
  confidencePercent: number;
  canonicalNetWorthAtScout: number;
  estimatedThugs: number;
  estimatedWeaponStrength: number;
  estimatedCash: number;
  estimatedDrugs: number;
  cartelId: string | null;
}

export interface AttackEligibilityInput {
  attackerId: string;
  defenderId: string;
  attackType: AttackType;
  attackingThugs: number;
  attackerNw: number;
  defenderNw: number;
  attackerTurns: number;
  attackerThugs: number;
  attackerRides: number;
  attackerLifeStatus: string;
  attackerTravelling: boolean;
  defenderLifeStatus: string;
  defenderTravelling: boolean;
  intelReport: PlayerIntelSnapshot | null;
  attacksOnTargetLast24h: number;
  now?: Date;
}

export function ridesRequired(attackingThugs: number): number {
  return ridesRequiredForThugs(attackingThugs, ATTACK_RULES.thugsPerRide);
}

export function isIntelReportValid(intel: PlayerIntelSnapshot | null, now = new Date()): boolean {
  if (!intel) return false;
  return new Date(intel.expiresAt).getTime() > now.getTime();
}

export function validateAttackEligibility(input: AttackEligibilityInput): string | null {
  const now = input.now ?? new Date();

  if (input.attackerId === input.defenderId) {
    return 'You cannot attack yourself.';
  }
  if (ATTACK_RULES.blockedAttackerLifeStatuses.includes(input.attackerLifeStatus as never)) {
    return 'You cannot attack in your current status.';
  }
  if (input.attackerTravelling) {
    return 'You cannot attack while travelling.';
  }
  if (ATTACK_RULES.blockedDefenderLifeStatuses.includes(input.defenderLifeStatus as never)) {
    return 'This target cannot be attacked.';
  }
  if (input.defenderTravelling) {
    return 'This target is travelling and cannot be attacked.';
  }
  if (!isIntelReportValid(input.intelReport, now)) {
    return 'You need a valid Scout intelligence report on this target. Scout them first.';
  }
  if (input.intelReport && input.intelReport.targetPlayerId !== input.defenderId) {
    return 'Scout report does not match this target.';
  }
  if (!isWithinAttackRange(input.attackerNw, input.defenderNw)) {
    return 'Target is outside your attack range (0.5×–2× net worth).';
  }

  const turnCost = ATTACK_RULES.turnCosts[input.attackType];
  if (input.attackerTurns < turnCost) {
    return `Insufficient turns. This attack requires ${turnCost} turns.`;
  }

  if (
    !Number.isInteger(input.attackingThugs) ||
    input.attackingThugs < ATTACK_RULES.minAttackingThugs ||
    input.attackingThugs > ATTACK_RULES.maxAttackingThugs
  ) {
    return 'Invalid attacking force size.';
  }
  if (input.attackingThugs > input.attackerThugs) {
    return 'You do not have enough thugs for this force.';
  }

  const requiredRides = ridesRequired(input.attackingThugs);
  if (input.attackerRides < requiredRides) {
    return `Insufficient rides. Need ${requiredRides} ride${requiredRides === 1 ? '' : 's'} for ${input.attackingThugs} thugs.`;
  }

  if (input.attacksOnTargetLast24h >= ATTACK_RULES.targetAttackCapPer24h) {
    return `Attack limit reached (${ATTACK_RULES.targetAttackCapPer24h} per target in 24 hours).`;
  }

  return null;
}
