'use server';

import {
  launchAttackAction as coreLaunchAttackAction,
  launchDirectAttackAction as coreLaunchDirectAttackAction,
  type AttackLaunchResult,
} from '@core/server/actions/attack.actions';
import type { ActionResult } from '@core/server/actions/auth.actions';
import type { AttackType } from '@core/config/game/attack-rules';
import { ATTACK_TYPE_LABELS, ATTACK_RULES } from '@core/config/game/attack-rules';
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
import { RankingsService } from '@local/server/services/rankings.service';
import { OfflineProtectionService } from '@core/server/services/offline-protection.service';
import { revalidatePath } from 'next/cache';
import { revalidatePlayersGameplayCache } from '@local/server/services/gameplay-cache';
import type { CombatPlayerRecord } from '@core/server/services/combat.service';
import type { AttackTargetCandidate } from '@local/features/attack/AttackForm.types';

export type { AttackLaunchResult, AttackTargetCandidate };

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
      attackerWeaponLosses: result.data.attackerWeaponLosses,
      defenderWeaponLosses: result.data.defenderWeaponLosses,
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
          attackerWeaponLosses: { glocks: 0, uzis: 0, aks: 0 },
          defenderWeaponLosses: { glocks: 0, uzis: 0, aks: 0 },
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
          attackerWeaponLosses: { glocks: 0, uzis: 0, aks: 0 },
          defenderWeaponLosses: { glocks: 0, uzis: 0, aks: 0 },
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

function eligibilityDisplayNote(
  code: ReturnType<typeof evaluateAttackTargetPreview>['code'],
  fallback: string | null,
): string {
  if (code === 'OFFLINE_PROTECTION_ACTIVE') return 'Protected';
  if (code === 'ATTACK_CAP_REACHED') return 'Attack limit reached';
  if (code === 'TARGET_UNAVAILABLE') return 'Unavailable';
  return fallback ?? 'Eligible';
}

export async function getAttackPageData(
  ctx: CanonicalPlayerContext,
  options?: { targetAlias?: string; reportId?: string },
) {
  const attackerNw = ctx.netWorth;
  const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000);

  const [seasonRankings, candidates, intelReports] = await Promise.all([
    RankingsService.getSeasonRankings(ctx.seasonId, 'overall'),
    prisma.player.findMany({
      where: {
        seasonId: ctx.seasonId,
        districtId: ctx.district.id,
        isSystemPlayer: false,
        id: { not: ctx.id },
      },
      include: {
        district: true,
        user: { select: { lastLoginAt: true } },
        statusExt: true,
      },
    }),
    ReportService.listValidPlayerIntelReports(ctx.id),
  ]);

  const rankById = new Map(seasonRankings.map((row) => [row.id, row.rank]));
  const activeIntelByTarget = new Map(
    intelReports
      .filter((report) => !report.expired)
      .map((report) => [report.intel.targetPlayerId, report]),
  );

  const candidateIds = candidates.map((player) => player.id);
  const [attackCounts, defenderStatusRows] = await Promise.all([
    candidateIds.length > 0
      ? prisma.combatEncounter.groupBy({
          by: ['defenderId'],
          where: {
            attackerId: ctx.id,
            defenderId: { in: candidateIds },
            createdAt: { gte: since24h },
          },
          _count: { _all: true },
        })
      : Promise.resolve([]),
    candidateIds.length > 0
      ? prisma.playerStatusExt.findMany({
          where: { playerId: { in: candidateIds } },
          select: {
            playerId: true,
            offlineDamagingHits: true,
            offlineProtectionActive: true,
            lastSeenAt: true,
          },
        })
      : Promise.resolve([]),
  ]);

  const attacksByDefender = new Map(
    attackCounts.map((row) => [row.defenderId, row._count._all]),
  );
  const offlineStateByDefender = new Map(
    defenderStatusRows.map((row) => [row.playerId, row]),
  );

  const targets: AttackTargetCandidate[] = [];

  for (const player of candidates) {
    const targetNw = NetWorthService.calculateFromPlayer(player);
    const attacksOnTarget = attacksByDefender.get(player.id) ?? 0;
    const offlineState = offlineStateByDefender.get(player.id) ?? {
      offlineDamagingHits: 0,
      offlineProtectionActive: false,
      lastSeenAt: null,
    };
    const preview = evaluateAttackTargetPreview({
      attackerId: ctx.id,
      defenderId: player.id,
      attackerDistrictId: ctx.district.id,
      defenderDistrictId: player.districtId,
      attackerNw,
      defenderNw: targetNw,
      defenderLifeStatus: player.lifeStatus,
      defenderTravelling: player.travelling,
      attacksOnTargetLast24h: attacksOnTarget,
      defenderOfflineProtected: OfflineProtectionService.isDefenderProtected(offlineState),
    });

    if (preview.code === 'TARGET_OUT_OF_RANGE') continue;

    const intel = activeIntelByTarget.get(player.id);
    const lastSeen = PlayerStatusService.resolveLastSeen(
      player.user.lastLoginAt,
      player.statusExt?.lastSeenAt,
      player.updatedAt,
    );
    const online = PlayerStatusService.isOnline(lastSeen);

    targets.push({
      playerId: player.id,
      alias: player.alias,
      aliasNormalized: player.aliasNormalized,
      rank: rankById.get(player.id) ?? 0,
      netWorth: targetNw,
      online,
      statusLabel: online ? 'Online' : 'Offline',
      hasIntel: !!intel,
      reportId: intel?.reportId ?? null,
      bands: intel?.bands ?? null,
      eligible: preview.eligible,
      eligibilityNote: eligibilityDisplayNote(preview.code, preview.message),
      attacksOnTarget,
    });
  }

  targets.sort((a, b) => {
    if (a.eligible !== b.eligible) return a.eligible ? -1 : 1;
    return b.netWorth - a.netWorth;
  });

  let initialTargetAlias = options?.targetAlias?.trim().toLowerCase();
  if (options?.reportId && !initialTargetAlias) {
    const fromReport = intelReports.find((r) => r.reportId === options.reportId);
    if (fromReport) {
      initialTargetAlias = fromReport.intel.targetAlias.trim().toLowerCase();
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
    initialTargetAlias,
    initialReportId: options?.reportId,
    attackRangeMinNetWorth: minAttackTargetNetWorth(attackerNw),
    intelTurnCost: ATTACK_RULES.intelGatherTurnCost,
    viewerCity: ctx.district.name,
  };
}
