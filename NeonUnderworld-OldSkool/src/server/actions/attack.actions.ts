'use server';

import {
  launchAttackAction as coreLaunchAttackAction,
  launchDirectAttackAction as coreLaunchDirectAttackAction,
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
import type { CanonicalPlayerContext } from '@local/server/services/player.service';
import { toUserMessage } from '@core/lib/game-engine/gameplay-errors';
import { evaluateAttackTargetPreview } from '@core/lib/game-engine/combat/eligibility';
import { minAttackTargetNetWorth } from '@core/config/game/redlite-rules';
import { PlayerStatusService } from '@local/server/services/player-status.service';
import { OfflineProtectionService } from '@core/server/services/offline-protection.service';
import { revalidatePath } from 'next/cache';
import { revalidatePlayersGameplayCache } from '@local/server/services/gameplay-cache';
import type { CombatPlayerRecord } from '@core/server/services/combat.service';
import { directAttackReportId } from '@local/features/attack/direct-attack';

export type { AttackLaunchResult };

const calculateNetWorth = (player: CombatPlayerRecord) =>
  NetWorthService.calculateFromPlayer(player);

async function finalizeAttackLaunch(
  attackerId: string,
  result: ActionResult<AttackLaunchResult>,
  attackType: AttackType,
): Promise<ActionResult<AttackLaunchResult>> {
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

  await revalidatePlayersGameplayCache([attackerId, defender.id]);
  revalidatePath('/', 'layout');
  revalidatePath('/command');
  revalidatePath('/reports');

  return {
    success: true,
    data: {
      ...result.data,
      attackerReportId,
      defenderReportId,
    },
  };
}

export async function launchAttackAction(
  scoutReportId: string,
  attackType: AttackType,
  attackingThugs: number,
  idempotencyKey: string,
): Promise<ActionResult<AttackLaunchResult>> {
  try {
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
          targetAliasNormalized: defender.aliasNormalized,
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

    return finalizeAttackLaunch(attackerId, result, attackType);
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
          targetAliasNormalized: defender.aliasNormalized,
          attackerReportId: existingEncounter.attackerReportId,
          defenderReportId: existingEncounter.defenderReportId,
          newTurns: 0,
          idempotentReplay: true,
        },
      };
    }

    const result = await coreLaunchDirectAttackAction(
      targetAliasNormalized,
      attackType,
      attackingThugs,
      idempotencyKey,
      calculateNetWorth,
    );

    return finalizeAttackLaunch(attackerId, result, attackType);
  } catch (error) {
    console.error('Direct attack launch error:', error);
    return { success: false, error: toUserMessage(error) };
  }
}

function totalDrugs(d: { hash: number; shrooms: number; coke: number; heroin: number }): number {
  return d.hash + d.shrooms + d.coke + d.heroin;
}

export async function getAttackPageData(
  ctx: CanonicalPlayerContext,
  options?: { targetAlias?: string },
) {
  const intelReports = await ReportService.listValidPlayerIntelReports(ctx.id);
  const attackerNw = ctx.netWorth;
  const activeIntel = intelReports.filter((r) => !r.expired);
  const targetIds = activeIntel.map((r) => r.intel.targetPlayerId);
  const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000);

  const [attackCounts, targetPlayers, defenderStatusRows] = await Promise.all([
    targetIds.length > 0
      ? prisma.combatEncounter.groupBy({
          by: ['defenderId'],
          where: {
            attackerId: ctx.id,
            defenderId: { in: targetIds },
            createdAt: { gte: since24h },
          },
          _count: { _all: true },
        })
      : Promise.resolve([]),
    targetIds.length > 0
      ? prisma.player.findMany({
          where: { id: { in: targetIds } },
          select: {
            id: true,
            districtId: true,
            lifeStatus: true,
            travelling: true,
            district: true,
            cash: true,
            bankCash: true,
            prostitutes: true,
            thugs: true,
            rides: true,
            glocks: true,
            uzis: true,
            aks: true,
            hash: true,
            shrooms: true,
            coke: true,
            heroin: true,
            businesses: true,
          },
        })
      : Promise.resolve([]),
    targetIds.length > 0
      ? prisma.playerStatusExt.findMany({
          where: { playerId: { in: targetIds } },
          select: {
            playerId: true,
            offlineDamagingHits: true,
            offlineProtectionActive: true,
            lastSeenAt: true,
          },
        })
      : Promise.resolve([]),
  ]);

  const offlineStateByDefender = new Map(
    defenderStatusRows.map((row) => [
      row.playerId,
      {
        offlineDamagingHits: row.offlineDamagingHits,
        offlineProtectionActive: row.offlineProtectionActive,
        lastSeenAt: row.lastSeenAt,
      },
    ]),
  );

  function defenderOfflineProtected(defenderId: string): boolean {
    const state = offlineStateByDefender.get(defenderId) ?? {
      offlineDamagingHits: 0,
      offlineProtectionActive: false,
      lastSeenAt: null,
    };
    return OfflineProtectionService.isDefenderProtected(state);
  }

  const attacksByDefender = new Map(
    attackCounts.map((row) => [row.defenderId, row._count._all]),
  );
  const playersById = new Map(targetPlayers.map((p) => [p.id, p]));

  const targets = activeIntel.flatMap((r) => {
    const attacksOnTarget = attacksByDefender.get(r.intel.targetPlayerId) ?? 0;
    const targetPlayer = playersById.get(r.intel.targetPlayerId);
    if (!targetPlayer) return [];

    const targetNw = NetWorthService.calculateFromPlayer(targetPlayer);
    const preview = evaluateAttackTargetPreview({
      attackerId: ctx.id,
      defenderId: targetPlayer.id,
      attackerDistrictId: ctx.district.id,
      defenderDistrictId: targetPlayer.districtId,
      attackerNw,
      defenderNw: targetNw,
      defenderLifeStatus: targetPlayer.lifeStatus,
      defenderTravelling: targetPlayer.travelling,
      attacksOnTargetLast24h: attacksOnTarget,
      defenderOfflineProtected: defenderOfflineProtected(targetPlayer.id),
    });

    if (preview.code === 'TARGET_OUT_OF_RANGE') return [];

    return [{
      reportId: r.reportId,
      alias: r.intel.targetAlias,
      city: r.intel.targetCity,
      bands: r.bands,
      netWorthEstimate: targetNw,
      reportAge: r.createdAt.toISOString(),
      attacksOnTarget,
      eligible: preview.eligible,
      eligibilityNote: preview.message ?? 'Eligible',
      isDirect: false,
    }];
  });

  if (options?.targetAlias) {
    const aliasNormalized = options.targetAlias.trim().toLowerCase();
    const alreadyListed = targets.some(
      (t) => t.alias.toLowerCase() === aliasNormalized || t.reportId === directAttackReportId(aliasNormalized),
    );
    if (!alreadyListed && aliasNormalized !== ctx.aliasNormalized) {
      const targetPlayer = await prisma.player.findFirst({
        where: {
          aliasNormalized,
          seasonId: ctx.seasonId,
          isSystemPlayer: false,
        },
        include: { district: true },
      });
      if (targetPlayer) {
        const attacksOnTarget = await prisma.combatEncounter.count({
          where: {
            attackerId: ctx.id,
            defenderId: targetPlayer.id,
            createdAt: { gte: since24h },
          },
        });
        const targetNw = NetWorthService.calculateFromPlayer(targetPlayer);
        const directStatus = await prisma.playerStatusExt.findUnique({
          where: { playerId: targetPlayer.id },
          select: {
            offlineDamagingHits: true,
            offlineProtectionActive: true,
            lastSeenAt: true,
          },
        });
        const preview = evaluateAttackTargetPreview({
          attackerId: ctx.id,
          defenderId: targetPlayer.id,
          attackerDistrictId: ctx.district.id,
          defenderDistrictId: targetPlayer.districtId,
          attackerNw,
          defenderNw: targetNw,
          defenderLifeStatus: targetPlayer.lifeStatus,
          defenderTravelling: targetPlayer.travelling,
          attacksOnTargetLast24h: attacksOnTarget,
          defenderOfflineProtected: OfflineProtectionService.isDefenderProtected({
            offlineDamagingHits: directStatus?.offlineDamagingHits ?? 0,
            offlineProtectionActive: directStatus?.offlineProtectionActive ?? false,
            lastSeenAt: directStatus?.lastSeenAt ?? null,
          }),
        });
        const eligibilityNote = preview.eligible
          ? 'Direct attack — no intel'
          : preview.message ?? 'Not eligible';

        targets.unshift({
          reportId: directAttackReportId(aliasNormalized),
          alias: targetPlayer.alias,
          city: targetPlayer.district.name,
          bands: {
            thugs: 'Unknown',
            weapons: 'Unknown',
            cash: 'Unknown',
            drugs: 'Unknown',
            cartel: 'Unknown',
            confidence: 0,
          },
          netWorthEstimate: targetNw,
          reportAge: new Date().toISOString(),
          attacksOnTarget,
          eligible: preview.eligible,
          eligibilityNote,
          isDirect: true,
        });
      }
    }
  }

  return {
    thugs: ctx.thugs,
    rides: ctx.rides,
    glocks: ctx.glocks,
    uzis: ctx.uzis,
    aks: ctx.aks,
    turns: ctx.turns,
    targets,
    attackerNetWorth: attackerNw,
    attackRangeMinNetWorth: minAttackTargetNetWorth(attackerNw),
  };
}
