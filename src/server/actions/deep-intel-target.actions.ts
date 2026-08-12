'use server';

import { prisma } from '@/lib/db/prisma';
import { requirePlayer } from '@/lib/auth/session';
import { deepIntelTargetSchema } from '@/lib/validation/schemas';
import { ATTACK_RULES } from '@/config/game/attack-rules';
import {
  consumeTurns,
  resolveCanonicalTurnState,
  settleTurnRegeneration,
} from '@/lib/game-engine/turns';
import { buildDeepIntelSnapshot, type DeepIntelSnapshot } from '@/lib/game-engine/combat/deep-intel';
import { isIntelReportValid, type PlayerIntelSnapshot } from '@/lib/game-engine/combat/eligibility';
import { SeasonInactiveError } from '@/lib/game-engine/errors';
import { assertPlayerCanPerformAction } from '@/lib/game-engine/player-action-guard';
import { GameplayError, toUserMessage } from '@/lib/game-engine/gameplay-errors';
import type { ActionResult } from './auth.actions';

export interface DeepIntelTargetResultData {
  turnsSpent: number;
  newTurns: number;
  targetAlias: string;
  targetPlayerId: string;
  deepIntel: DeepIntelSnapshot;
}

function findValidBasicIntel(
  reports: Array<{ metadata: unknown }>,
  targetPlayerId: string,
  now = new Date(),
): PlayerIntelSnapshot | null {
  for (const row of reports) {
    const meta = row.metadata as {
      type?: string;
      intel?: PlayerIntelSnapshot;
    } | null;
    if (meta?.type !== 'PLAYER_INTEL' || !meta.intel) continue;
    if (meta.intel.targetPlayerId !== targetPlayerId) continue;
    if (!isIntelReportValid(meta.intel, now)) continue;
    return meta.intel;
  }
  return null;
}

export async function deepIntelTargetAction(
  targetAlias: string,
  idempotencyKey: string,
  calculateNetWorth: (player: {
    id: string;
    alias: string;
    cash: number;
    bankCash: number;
    thugs: number;
    prostitutes: number;
    rides: number;
    glocks: number;
    uzis: number;
    aks: number;
    hash: number;
    shrooms: number;
    coke: number;
    heroin: number;
    businesses: number;
    cartelId: string | null;
    district: { name: string };
  }) => number,
): Promise<ActionResult<DeepIntelTargetResultData>> {
  try {
    const session = await requirePlayer();
    const parsed = deepIntelTargetSchema.safeParse({ targetAlias, idempotencyKey });
    if (!parsed.success) {
      return { success: false, error: parsed.error.issues[0]?.message ?? 'Invalid input' };
    }

    const playerId = session.user.playerId!;
    const aliasNormalized = parsed.data.targetAlias.trim().toLowerCase();

    const existing = await prisma.gameAction.findUnique({
      where: { playerId_idempotencyKey: { playerId, idempotencyKey } },
    });
    if (existing?.resultPayload) {
      return { success: true, data: existing.resultPayload as unknown as DeepIntelTargetResultData };
    }

    const result = await prisma.$transaction(async (tx) => {
      const scout = await tx.player.findUniqueOrThrow({
        where: { id: playerId },
        include: { turnState: true, season: true },
      });
      if (!scout.turnState) throw new Error('Turn state missing');
      if (scout.season.status !== 'ACTIVE') throw new SeasonInactiveError();
      assertPlayerCanPerformAction(scout);

      const target = await tx.player.findFirst({
        where: { aliasNormalized, seasonId: scout.seasonId, isSystemPlayer: false },
        include: { district: true },
      });
      if (!target) throw new GameplayError('INVALID_TARGET');
      if (target.id === playerId) {
        throw new GameplayError('INVALID_TARGET', 'You cannot gather intel on yourself.');
      }
      if (scout.districtId !== target.districtId) {
        throw new GameplayError(
          'TARGET_WRONG_DISTRICT',
          'You need to be in the same city to gather deep intel on this player.',
        );
      }

      const intelReports = await tx.report.findMany({
        where: { playerId, category: 'SCOUT' },
        orderBy: { createdAt: 'desc' },
        take: 100,
        select: { metadata: true },
      });

      const basicIntel = findValidBasicIntel(intelReports, target.id);
      if (!basicIntel) {
        throw new GameplayError(
          'EXPIRED_INTEL',
          'Gather basic intel on this player before deep intel.',
        );
      }

      const settled = settleTurnRegeneration(
        resolveCanonicalTurnState({
          currentTurns: scout.turnState.currentTurns,
          lastRegeneratedAt: scout.turnState.lastRegeneratedAt,
          turnCap: scout.turnState.turnCap,
          regenerationRatePerMs: scout.turnState.regenerationRate,
        }),
      );

      const turnCost = ATTACK_RULES.deepIntelTurnCost;
      if (settled.currentTurns < turnCost) {
        throw new GameplayError('INSUFFICIENT_TURNS');
      }

      const { newState } = consumeTurns(settled, turnCost);
      const nw = calculateNetWorth(target);
      const deepIntel = buildDeepIntelSnapshot(
        {
          id: target.id,
          alias: target.alias,
          districtName: target.district.name,
          thugs: target.thugs,
          prostitutes: target.prostitutes,
          glocks: target.glocks,
          uzis: target.uzis,
          aks: target.aks,
          cash: target.cash,
          hash: target.hash,
          shrooms: target.shrooms,
          coke: target.coke,
          heroin: target.heroin,
          cartelId: target.cartelId,
          canonicalNetWorth: nw,
        },
        playerId,
        idempotencyKey,
      );

      await tx.playerTurnState.update({
        where: { playerId },
        data: {
          currentTurns: newState.currentTurns,
          lastRegeneratedAt: newState.lastRegeneratedAt,
        },
      });

      const resultData: DeepIntelTargetResultData = {
        turnsSpent: turnCost,
        newTurns: newState.currentTurns,
        targetAlias: target.alias,
        targetPlayerId: target.id,
        deepIntel,
      };

      await tx.gameAction.create({
        data: {
          playerId,
          seasonId: scout.seasonId,
          actionType: 'DEEP_INTEL_TARGET',
          idempotencyKey,
          requestPayload: { targetAlias: parsed.data.targetAlias } as object,
          resultPayload: resultData as object,
          turnsSpent: turnCost,
        },
      });

      return resultData;
    }, { isolationLevel: 'Serializable' });

    return { success: true, data: result };
  } catch (error) {
    console.error('Deep intel target error:', error);
    return { success: false, error: toUserMessage(error) };
  }
}
