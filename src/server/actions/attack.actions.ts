'use server';

import { requirePlayer } from '@/lib/auth/session';
import { attackLaunchSchema, directAttackLaunchSchema } from '@/lib/validation/schemas';
import { SeasonInactiveError } from '@/lib/game-engine/errors';
import { toUserMessage } from '@/lib/game-engine/gameplay-errors';
import {
  resolveAttackEncounter,
} from '@/server/services/combat.service';
import type { ActionResult } from './auth.actions';
import type { AttackType } from '@/config/game/attack-rules';

export interface AttackLaunchResult {
  encounterId: string;
  attackType: AttackType;
  outcome: string;
  outcomeLabel: string;
  attackingThugs: number;
  attackerLosses: number;
  defenderLosses: number;
  attackerWeaponLosses: { glocks: number; uzis: number; aks: number };
  defenderWeaponLosses: { glocks: number; uzis: number; aks: number };
  attackerReturned: number;
  cashStolen: number;
  workersStolen: number;
  drugsStolen: { hash: number; shrooms: number; coke: number; heroin: number };
  turnsSpent: number;
  ridesUsed: number;
  weaponCoverage: string;
  forceEstimate: string;
  targetAlias: string;
  targetAliasNormalized: string;
  attackerReportId: string;
  defenderReportId: string;
  newTurns: number;
  idempotentReplay: boolean;
}

export async function launchAttackAction(
  scoutReportId: string,
  attackType: AttackType,
  attackingThugs: number,
  idempotencyKey: string,
): Promise<ActionResult<AttackLaunchResult>> {
  try {
    const session = await requirePlayer();
    const parsed = attackLaunchSchema.safeParse({
      scoutReportId,
      attackType,
      attackingThugs,
      idempotencyKey,
    });
    if (!parsed.success) {
      return { success: false, error: parsed.error.issues[0]?.message ?? 'Invalid input' };
    }

    const data = await resolveAttackEncounter(
      session.user.playerId!,
      session.user.id,
      { kind: 'intel', scoutReportId: parsed.data.scoutReportId },
      parsed.data.attackType,
      parsed.data.attackingThugs,
      parsed.data.idempotencyKey,
    );

    return {
      success: true,
      data: {
        encounterId: data.encounterId,
        attackType: data.attackType,
        outcome: data.outcome,
        outcomeLabel: data.outcomeLabel,
        attackingThugs: data.attackingThugs,
        attackerLosses: data.attackerLosses,
        defenderLosses: data.defenderLosses,
        attackerWeaponLosses: data.attackerWeaponLosses,
        defenderWeaponLosses: data.defenderWeaponLosses,
        attackerReturned: data.attackerReturned,
        cashStolen: data.cashStolen,
        workersStolen: data.workersStolen,
        drugsStolen: data.drugsStolen,
        turnsSpent: data.turnsSpent,
        ridesUsed: data.ridesUsed,
        weaponCoverage: data.weaponCoverage,
        forceEstimate: data.forceEstimate,
        targetAlias: data.targetAlias,
        targetAliasNormalized: data.targetAliasNormalized,
        attackerReportId: '',
        defenderReportId: '',
        newTurns: data.newTurns,
        idempotentReplay: data.idempotentReplay,
      },
    };
  } catch (error) {
    console.error('Attack launch error:', error);
    return { success: false, error: toUserMessage(error) };
  }
}

export async function launchDirectAttackAction(
  targetAliasNormalized: string,
  attackType: AttackType,
  attackingThugs: number,
  idempotencyKey: string,
): Promise<ActionResult<AttackLaunchResult>> {
  try {
    const session = await requirePlayer();
    const parsed = directAttackLaunchSchema.safeParse({
      targetAliasNormalized,
      attackType,
      attackingThugs,
      idempotencyKey,
    });
    if (!parsed.success) {
      return { success: false, error: parsed.error.issues[0]?.message ?? 'Invalid input' };
    }

    const data = await resolveAttackEncounter(
      session.user.playerId!,
      session.user.id,
      { kind: 'direct', defenderAliasNormalized: parsed.data.targetAliasNormalized.trim().toLowerCase() },
      parsed.data.attackType,
      parsed.data.attackingThugs,
      parsed.data.idempotencyKey,
    );

    return {
      success: true,
      data: {
        encounterId: data.encounterId,
        attackType: data.attackType,
        outcome: data.outcome,
        outcomeLabel: data.outcomeLabel,
        attackingThugs: data.attackingThugs,
        attackerLosses: data.attackerLosses,
        defenderLosses: data.defenderLosses,
        attackerWeaponLosses: data.attackerWeaponLosses,
        defenderWeaponLosses: data.defenderWeaponLosses,
        attackerReturned: data.attackerReturned,
        cashStolen: data.cashStolen,
        workersStolen: data.workersStolen,
        drugsStolen: data.drugsStolen,
        turnsSpent: data.turnsSpent,
        ridesUsed: data.ridesUsed,
        weaponCoverage: data.weaponCoverage,
        forceEstimate: data.forceEstimate,
        targetAlias: data.targetAlias,
        targetAliasNormalized: data.targetAliasNormalized,
        attackerReportId: '',
        defenderReportId: '',
        newTurns: data.newTurns,
        idempotentReplay: data.idempotentReplay,
      },
    };
  } catch (error) {
    console.error('Direct attack launch error:', error);
    return { success: false, error: toUserMessage(error) };
  }
}
