'use server';

import {
  launchAttackAction as coreLaunchAttackAction,
  type AttackLaunchResult,
} from '@core/server/actions/attack.actions';
import type { ActionResult } from '@core/server/actions/auth.actions';
import type { AttackType } from '@core/config/game/attack-rules';
import { ATTACK_TYPE_LABELS } from '@core/config/game/attack-rules';
import { auth } from '@local/lib/auth/config';
import { prisma } from '@core/lib/db/prisma';
import {
  ACTIVITY_TYPES,
  buildAttackActivityMessage,
  buildDefenceActivityMessage,
} from '@local/config/activity-types';
import { ActivityService } from '@local/server/services/activity.service';
import { ReportService } from '@local/server/services/report.service';
import { NetWorthService } from '@local/server/services/net-worth.service';
import { isWithinAttackRange } from '@core/lib/game-engine/combat-rules';
import { PlayerStatusService } from '@local/server/services/player-status.service';
import type { CombatPlayerRecord } from '@core/server/services/combat.service';

export type { AttackLaunchResult };

const calculateNetWorth = (player: CombatPlayerRecord) =>
  NetWorthService.calculateFromPlayer(player);

export async function launchAttackAction(
  scoutReportId: string,
  attackType: AttackType,
  attackingThugs: number,
  idempotencyKey: string,
): Promise<ActionResult<AttackLaunchResult>> {
  const session = await auth();
  const attackerId = session?.user?.playerId;
  if (!attackerId) return { success: false, error: 'Not authenticated' };

  const existingEncounter = await prisma.combatEncounter.findUnique({
    where: { attackerId_idempotencyKey: { attackerId, idempotencyKey } },
  });

  if (existingEncounter?.attackerReportId && existingEncounter.defenderReportId) {
    const defender = await prisma.player.findUniqueOrThrow({ where: { id: existingEncounter.defenderId } });
    return {
      success: true,
      data: {
        encounterId: existingEncounter.id,
        attackType: existingEncounter.attackType as AttackType,
        outcome: existingEncounter.outcome,
        outcomeLabel: existingEncounter.outcome,
        attackingThugs: existingEncounter.attackingThugs,
        attackerLosses: existingEncounter.attackerLosses,
        defenderLosses: existingEncounter.defenderLosses,
        attackerReturned: existingEncounter.attackerReturned,
        cashStolen: existingEncounter.cashStolen,
        drugsStolen: (existingEncounter.drugsStolen as AttackLaunchResult['drugsStolen']) ?? {
          hash: 0,
          shrooms: 0,
          coke: 0,
          heroin: 0,
        },
        turnsSpent: existingEncounter.turnsSpent,
        ridesUsed: existingEncounter.ridesUsed,
        weaponCoverage: '',
        forceEstimate: '',
        targetAlias: defender.alias,
        attackerReportId: existingEncounter.attackerReportId,
        defenderReportId: existingEncounter.defenderReportId,
        newTurns: 0,
        idempotentReplay: true,
      },
    };
  }

  const result = await coreLaunchAttackAction(
    scoutReportId,
    attackType,
    attackingThugs,
    idempotencyKey,
    calculateNetWorth,
  );

  if (!result.success) return result;
  if (result.data.idempotentReplay) return result;

  const attacker = await prisma.player.findUniqueOrThrow({ where: { id: attackerId } });
  const defender = await prisma.player.findUniqueOrThrow({
    where: { id: (await prisma.combatEncounter.findUniqueOrThrow({ where: { id: result.data.encounterId } })).defenderId },
  });

  const encounter = await prisma.combatEncounter.findUniqueOrThrow({
    where: { id: result.data.encounterId },
  });

  const defenderThugsBefore =
    (encounter.defenderForceSnapshot as { thugsDefending?: number })?.thugsDefending ?? 0;

  const { attackerReportId, defenderReportId } = await ReportService.createCombatReports(
    attackerId,
    defender.id,
    attacker.alias,
    defender.alias,
    {
      encounterId: encounter.id,
      attackType,
      targetAlias: defender.alias,
      attackerAlias: attacker.alias,
      attackingThugs: result.data.attackingThugs,
      ridesUsed: result.data.ridesUsed,
      weaponCoverage: result.data.weaponCoverage,
      attackerLosses: result.data.attackerLosses,
      defenderLosses: result.data.defenderLosses,
      attackerReturned: result.data.attackerReturned,
      defenderThugsBefore,
      cashStolen: result.data.cashStolen,
      drugsStolen: result.data.drugsStolen,
      outcome: result.data.outcome,
      outcomeLabel: result.data.outcomeLabel,
      scoutConfidence: 0,
      cartelParticipated: false,
      turnsSpent: result.data.turnsSpent,
      resolvedAt: new Date().toISOString(),
    },
  );

  await prisma.combatEncounter.update({
    where: { id: encounter.id },
    data: { attackerReportId, defenderReportId },
  });

  const attackLabel = ATTACK_TYPE_LABELS[attackType];
  await ActivityService.record(
    attackerId,
    ACTIVITY_TYPES.ATTACK,
    buildAttackActivityMessage(defender.alias, attackLabel, result.data.outcome),
    { encounterId: encounter.id, reportId: attackerReportId },
  );
  await ActivityService.record(
    defender.id,
    ACTIVITY_TYPES.DEFENCE,
    buildDefenceActivityMessage(attacker.alias, attackLabel, result.data.outcome),
    { encounterId: encounter.id, reportId: defenderReportId },
  );

  const defenderNotification =
    result.data.cashStolen > 0
      ? `You were attacked. $${result.data.cashStolen.toLocaleString()} stolen from cash on hand.`
      : totalDrugs(result.data.drugsStolen) > 0
        ? 'You were attacked. Drug stock was raided.'
        : 'You were attacked. New defence report available.';
  await PlayerStatusService.setNotification(defender.id, defenderNotification);

  return {
    success: true,
    data: {
      ...result.data,
      attackerReportId,
      defenderReportId,
    },
  };
}

function totalDrugs(d: { hash: number; shrooms: number; coke: number; heroin: number }): number {
  return d.hash + d.shrooms + d.coke + d.heroin;
}

export async function getAttackPageData(playerId: string) {
  const player = await prisma.player.findUniqueOrThrow({
    where: { id: playerId },
    include: { turnState: true, district: true },
  });

  const intelReports = await ReportService.listValidPlayerIntelReports(playerId);
  const attackerNw = NetWorthService.calculateFromPlayer(player);

  const targets = await Promise.all(
    intelReports
      .filter((r) => !r.expired)
      .map(async (r) => {
        const attacksOnTarget = await prisma.combatEncounter.count({
          where: {
            attackerId: playerId,
            defenderId: r.intel.targetPlayerId,
            createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
          },
        });

        const targetPlayer = await prisma.player.findUnique({
          where: { id: r.intel.targetPlayerId },
        });
        const targetNw = targetPlayer
          ? NetWorthService.calculateFromPlayer(targetPlayer)
          : r.intel.canonicalNetWorthAtScout;
        const inRange = isWithinAttackRange(attackerNw, targetNw);

        return {
          reportId: r.reportId,
          alias: r.intel.targetAlias,
          city: r.intel.targetCity,
          bands: r.bands,
          netWorthEstimate: r.intel.canonicalNetWorthAtScout,
          reportAge: r.createdAt.toISOString(),
          attacksOnTarget,
          eligible: inRange,
          eligibilityNote: inRange
            ? 'Eligible'
            : 'Outside net-worth range (0.5×–2×)',
        };
      }),
  );

  return {
    thugs: player.thugs,
    rides: player.rides,
    glocks: player.glocks,
    uzis: player.uzis,
    aks: player.aks,
    turns: player.turnState?.currentTurns ?? 0,
    targets,
    attackerNetWorth: attackerNw,
  };
}
