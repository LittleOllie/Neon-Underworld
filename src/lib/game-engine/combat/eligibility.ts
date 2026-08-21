import {
  attackRangeViolation,
  isWithinAttackRange,
  type AttackRangeViolation,
} from '@/config/game/redlite-rules';
import { ATTACK_RULES, type AttackType } from '@/config/game/attack-rules';
import { formatInsufficientTurnsForAttack } from '@/lib/game-engine/combat/attack-presentation';
import { maxCommitmentForAttack } from '@/lib/game-engine/combat/commitment';
import { WORKER_POACHING_RULES } from '@/config/game/worker-poaching-rules';
import { ridesRequiredForThugs } from '@/lib/game-engine/combat-rules';
import {
  GAMEPLAY_ERROR_MESSAGES,
  GAMEPLAY_CONTEXT_MESSAGES,
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
  defenderWorkers?: number;
  defenderOfflineProtected?: boolean;
  /** Skip intel requirement — blind attack without prior player intel */
  allowDirectAttack?: boolean;
  now?: Date;
}

export function ridesRequired(attackingThugs: number): number {
  return ridesRequiredForThugs(attackingThugs, ATTACK_RULES.thugsPerRide);
}

export function attackRangeErrorMessage(
  attackerNw: number,
  defenderNw: number,
  context: 'intel' | 'execution' = 'intel',
): string {
  if (context === 'execution') {
    return GAMEPLAY_CONTEXT_MESSAGES.attackTargetNowOutOfRange;
  }
  const violation = attackRangeViolation(attackerNw, defenderNw);
  if (violation === 'below') return GAMEPLAY_CONTEXT_MESSAGES.intelTargetOutOfRange;
  if (violation === 'above') return GAMEPLAY_CONTEXT_MESSAGES.intelTargetAboveRange;
  return GAMEPLAY_ERROR_MESSAGES.TARGET_OUT_OF_RANGE;
}

export function attackRangeIssueHeading(violation: AttackRangeViolation): string {
  return violation === 'above'
    ? GAMEPLAY_CONTEXT_MESSAGES.aboveAttackRangeHeading
    : GAMEPLAY_CONTEXT_MESSAGES.belowAttackRangeHeading;
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
    input.attackingThugs < ATTACK_RULES.minAttackingThugs
  ) {
    return 'INVALID_FORCE';
  }
  const maxCommit = maxCommitmentForAttack(input.attackType, input.attackerThugs);
  if (input.attackingThugs > maxCommit || input.attackingThugs > input.attackerThugs) {
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

  if (input.attackType === 'POACH_WORKERS') {
    const workers = input.defenderWorkers ?? 0;
    if (workers < WORKER_POACHING_RULES.minWorkersToPoach) {
      return 'POACH_TARGET_TOO_SMALL';
    }
  }

  return null;
}

export function validateAttackEligibility(input: AttackEligibilityInput): string | null {
  const code = validateAttackEligibilityCode(input);
  if (!code) return null;
  if (code === 'INSUFFICIENT_TURNS') {
    return formatInsufficientTurnsForAttack(input.attackType, input.attackerTurns);
  }
  if (code === 'TARGET_OUT_OF_RANGE') {
    return attackRangeErrorMessage(input.attackerNw, input.defenderNw, 'execution');
  }
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
    return {
      eligible: false,
      code: 'TARGET_OUT_OF_RANGE',
      message: attackRangeErrorMessage(input.attackerNw, input.defenderNw, 'intel'),
    };
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

export type RequestedTargetIssueCode =
  | 'INVALID_TARGET'
  | 'TARGET_WRONG_DISTRICT'
  | 'TARGET_OUT_OF_RANGE'
  | 'TARGET_UNAVAILABLE'
  | 'SELF';

export interface RequestedTargetResolution {
  issue: RequestedTargetIssueCode | null;
  heading: string | null;
  message: string | null;
  alias?: string;
  aliasNormalized?: string;
}

/** Resolve why a deep-linked target cannot appear on the Attack page. */
export function resolveRequestedTargetIssue(input: {
  attackerId: string;
  defenderId: string;
  attackerDistrictId: string;
  defenderDistrictId: string;
  attackerNw: number;
  defenderNw: number;
  defenderLifeStatus: string;
  defenderTravelling: boolean;
  defenderAlias?: string;
  defenderAliasNormalized?: string;
}): RequestedTargetResolution {
  if (input.attackerId === input.defenderId) {
    return {
      issue: 'SELF',
      heading: null,
      message: 'You cannot attack yourself.',
    };
  }
  if (ATTACK_RULES.blockedDefenderLifeStatuses.includes(input.defenderLifeStatus as never)) {
    return {
      issue: 'TARGET_UNAVAILABLE',
      heading: null,
      message: GAMEPLAY_ERROR_MESSAGES.TARGET_UNAVAILABLE,
      alias: input.defenderAlias,
      aliasNormalized: input.defenderAliasNormalized,
    };
  }
  if (input.defenderTravelling) {
    return {
      issue: 'TARGET_UNAVAILABLE',
      heading: null,
      message: GAMEPLAY_ERROR_MESSAGES.TARGET_UNAVAILABLE,
      alias: input.defenderAlias,
      aliasNormalized: input.defenderAliasNormalized,
    };
  }
  if (input.attackerDistrictId !== input.defenderDistrictId) {
    return {
      issue: 'TARGET_WRONG_DISTRICT',
      heading: null,
      message: GAMEPLAY_CONTEXT_MESSAGES.targetNoLongerInCity,
      alias: input.defenderAlias,
      aliasNormalized: input.defenderAliasNormalized,
    };
  }
  if (!isWithinAttackRange(input.attackerNw, input.defenderNw)) {
    const violation = attackRangeViolation(input.attackerNw, input.defenderNw)!;
    return {
      issue: 'TARGET_OUT_OF_RANGE',
      heading: attackRangeIssueHeading(violation),
      message: attackRangeErrorMessage(input.attackerNw, input.defenderNw, 'intel'),
      alias: input.defenderAlias,
      aliasNormalized: input.defenderAliasNormalized,
    };
  }
  return {
    issue: null,
    heading: null,
    message: null,
    alias: input.defenderAlias,
    aliasNormalized: input.defenderAliasNormalized,
  };
}

export type ProfileAttackEligibility =
  | { status: 'eligible' }
  | { status: 'below_range'; heading: string; message: string }
  | { status: 'above_range'; heading: string; message: string }
  | { status: 'unavailable'; message: string }
  | { status: 'wrong_district' }
  | { status: 'self' };

export function resolveProfileAttackEligibility(input: {
  viewerId: string;
  viewerDistrictId: string;
  viewerNw: number;
  targetPlayerId: string;
  targetDistrictId: string;
  targetNw: number;
  targetLifeStatus: string;
  targetTravelling: boolean;
}): ProfileAttackEligibility {
  const resolution = resolveRequestedTargetIssue({
    attackerId: input.viewerId,
    defenderId: input.targetPlayerId,
    attackerDistrictId: input.viewerDistrictId,
    defenderDistrictId: input.targetDistrictId,
    attackerNw: input.viewerNw,
    defenderNw: input.targetNw,
    defenderLifeStatus: input.targetLifeStatus,
    defenderTravelling: input.targetTravelling,
  });
  if (resolution.issue === 'SELF') return { status: 'self' };
  if (resolution.issue === 'TARGET_WRONG_DISTRICT') return { status: 'wrong_district' };
  if (resolution.issue === 'TARGET_OUT_OF_RANGE') {
    const violation = attackRangeViolation(input.viewerNw, input.targetNw);
    const status = violation === 'above' ? 'above_range' : 'below_range';
    return {
      status,
      heading: resolution.heading ?? attackRangeIssueHeading(violation ?? 'below'),
      message: resolution.message ?? attackRangeErrorMessage(input.viewerNw, input.targetNw, 'intel'),
    };
  }
  if (resolution.issue === 'TARGET_UNAVAILABLE') {
    return { status: 'unavailable', message: resolution.message ?? GAMEPLAY_ERROR_MESSAGES.TARGET_UNAVAILABLE };
  }
  return { status: 'eligible' };
}
