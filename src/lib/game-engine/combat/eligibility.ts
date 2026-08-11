import { isWithinAttackRange } from '@/config/game/redlite-rules';
import { ATTACK_RULES, type AttackType } from '@/config/game/attack-rules';
import { ridesRequiredForThugs } from '@/lib/game-engine/combat-rules';
import {
  GAMEPLAY_ERROR_MESSAGES,
  type GameplayErrorCode,
} from '@/lib/game-engine/gameplay-errors';

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
  attackerDistrictId: string;
  defenderDistrictId: string;
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
  defenderOfflineProtected?: boolean;
  /** Skip intel requirement — blind attack without prior player intel */
  allowDirectAttack?: boolean;
  now?: Date;
}

export function ridesRequired(attackingThugs: number): number {
  return ridesRequiredForThugs(attackingThugs, ATTACK_RULES.thugsPerRide);
}

export function isIntelReportValid(intel: PlayerIntelSnapshot | null, now = new Date()): boolean {
  if (!intel) return false;
  return new Date(intel.expiresAt).getTime() > now.getTime();
}

export function validateAttackEligibilityCode(
  input: AttackEligibilityInput,
): GameplayErrorCode | null {
  const now = input.now ?? new Date();

  if (input.attackerId === input.defenderId) {
    return 'INVALID_TARGET';
  }
  if (ATTACK_RULES.blockedAttackerLifeStatuses.includes(input.attackerLifeStatus as never)) {
    return 'PLAYER_INCAPACITATED';
  }
  if (input.attackerTravelling) {
    return 'PLAYER_TRAVELLING';
  }
  if (ATTACK_RULES.blockedDefenderLifeStatuses.includes(input.defenderLifeStatus as never)) {
    return 'TARGET_UNAVAILABLE';
  }
  if (input.defenderTravelling) {
    return 'TARGET_UNAVAILABLE';
  }
  if (!input.allowDirectAttack) {
    if (!isIntelReportValid(input.intelReport, now)) {
      return 'EXPIRED_INTEL';
    }
    if (input.intelReport && input.intelReport.targetPlayerId !== input.defenderId) {
      return 'INVALID_INTEL';
    }
  }
  if (input.attackerDistrictId !== input.defenderDistrictId) {
    return 'TARGET_WRONG_DISTRICT';
  }
  if (!isWithinAttackRange(input.attackerNw, input.defenderNw)) {
    return 'TARGET_OUT_OF_RANGE';
  }

  const turnCost = ATTACK_RULES.turnCosts[input.attackType];
  if (input.attackerTurns < turnCost) {
    return 'INSUFFICIENT_TURNS';
  }

  if (
    !Number.isInteger(input.attackingThugs) ||
    input.attackingThugs < ATTACK_RULES.minAttackingThugs ||
    input.attackingThugs > ATTACK_RULES.maxAttackingThugs
  ) {
    return 'INVALID_FORCE';
  }
  if (input.attackingThugs > input.attackerThugs) {
    return 'INVALID_FORCE';
  }

  const requiredRides = ridesRequired(input.attackingThugs);
  if (input.attackerRides < requiredRides) {
    return 'INSUFFICIENT_RIDES';
  }

  if (input.defenderOfflineProtected) {
    return 'OFFLINE_PROTECTION_ACTIVE';
  }

  if (input.attacksOnTargetLast24h >= ATTACK_RULES.targetAttackCapPer24h) {
    return 'ATTACK_CAP_REACHED';
  }

  return null;
}

export function validateAttackEligibility(input: AttackEligibilityInput): string | null {
  const code = validateAttackEligibilityCode(input);
  if (!code) return null;
  return GAMEPLAY_ERROR_MESSAGES[code];
}

/** Lightweight target preview for attack UI — omits force/turn/ride checks. */
export interface AttackTargetPreviewInput {
  attackerId: string;
  defenderId: string;
  attackerDistrictId: string;
  defenderDistrictId: string;
  attackerNw: number;
  defenderNw: number;
  defenderLifeStatus: string;
  defenderTravelling: boolean;
  attacksOnTargetLast24h: number;
  defenderOfflineProtected?: boolean;
}

export function evaluateAttackTargetPreview(input: AttackTargetPreviewInput): {
  eligible: boolean;
  code: GameplayErrorCode | null;
  message: string | null;
} {
  if (input.attackerId === input.defenderId) {
    return { eligible: false, code: 'INVALID_TARGET', message: GAMEPLAY_ERROR_MESSAGES.INVALID_TARGET };
  }
  if (ATTACK_RULES.blockedDefenderLifeStatuses.includes(input.defenderLifeStatus as never)) {
    return { eligible: false, code: 'TARGET_UNAVAILABLE', message: GAMEPLAY_ERROR_MESSAGES.TARGET_UNAVAILABLE };
  }
  if (input.defenderTravelling) {
    return { eligible: false, code: 'TARGET_UNAVAILABLE', message: GAMEPLAY_ERROR_MESSAGES.TARGET_UNAVAILABLE };
  }
  if (input.attackerDistrictId !== input.defenderDistrictId) {
    return { eligible: false, code: 'TARGET_WRONG_DISTRICT', message: GAMEPLAY_ERROR_MESSAGES.TARGET_WRONG_DISTRICT };
  }
  if (!isWithinAttackRange(input.attackerNw, input.defenderNw)) {
    return { eligible: false, code: 'TARGET_OUT_OF_RANGE', message: GAMEPLAY_ERROR_MESSAGES.TARGET_OUT_OF_RANGE };
  }
  if (input.attacksOnTargetLast24h >= ATTACK_RULES.targetAttackCapPer24h) {
    return { eligible: false, code: 'ATTACK_CAP_REACHED', message: GAMEPLAY_ERROR_MESSAGES.ATTACK_CAP_REACHED };
  }
  if (input.defenderOfflineProtected) {
    return {
      eligible: false,
      code: 'OFFLINE_PROTECTION_ACTIVE',
      message: GAMEPLAY_ERROR_MESSAGES.OFFLINE_PROTECTION_ACTIVE,
    };
  }
  return { eligible: true, code: null, message: null };
}
