'use server';

import { prisma } from '@/lib/db/prisma';
import { requirePlayer } from '@/lib/auth/session';
import { scoutSchema } from '@/lib/validation/schemas';
import {
  settleTurnRegeneration,
  consumeTurns,
} from '@/lib/game-engine/turns';
import {
  resolveScouting,
  validateScoutAmount,
} from '@/lib/game-engine/scouting';
import {
  calculateProstituteHappiness,
  calculateThugHappiness,
} from '@/lib/game-engine/happiness';
import { deriveScoutSeed } from '@/lib/game-engine/rng';
import { calculateNetWorth, netWorthDelta } from '@/lib/game-engine/net-worth';
import { playerToResources, snapshotPlayerState } from '@/lib/game-engine/state';
import {
  DuplicateActionError,
  InvalidScoutAmountError,
  SeasonInactiveError,
  toUserMessage,
} from '@/lib/game-engine/errors';
import type { DistrictModifiers } from '@/config/game/balance';
import type { ActionResult } from './auth.actions';

export interface ScoutResultData {
  turnsSpent: number;
  prostitutesFound: number;
  thugsFound: number;
  cashEarned: number;
  prostitutesLost: number;
  thugsLost: number;
  netWorthChange: number;
  newNetWorth: number;
  newTurns: number;
  summary: string;
  newCash: number;
  newProstitutes: number;
  newThugs: number;
}

export async function scoutAction(
  turns: number,
  idempotencyKey: string,
  areaSlug?: string,
): Promise<ActionResult<ScoutResultData>> {
  try {
    const session = await requirePlayer();
    const parsed = scoutSchema.safeParse({ turns, areaSlug, idempotencyKey });
    if (!parsed.success) {
      return { success: false, error: parsed.error.issues[0]?.message ?? 'Invalid input' };
    }

    const playerId = session.user.playerId!;

    const existing = await prisma.gameAction.findUnique({
      where: {
        playerId_idempotencyKey: { playerId, idempotencyKey },
      },
    });

    if (existing?.resultPayload) {
      return { success: true, data: existing.resultPayload as unknown as ScoutResultData };
    }

    const result = await prisma.$transaction(async (tx) => {
      const player = await tx.player.findUniqueOrThrow({
        where: { id: playerId },
        include: { turnState: true, district: true, season: true },
      });

      if (player.season.status !== 'ACTIVE') {
        throw new SeasonInactiveError();
      }

      if (!player.turnState) {
        throw new Error('Turn state not found');
      }

      const now = new Date();
      const settled = settleTurnRegeneration({
        currentTurns: player.turnState.currentTurns,
        lastRegeneratedAt: player.turnState.lastRegeneratedAt,
        turnCap: player.turnState.turnCap,
        regenerationRatePerMs: player.turnState.regenerationRate,
      }, now);

      const validation = validateScoutAmount(parsed.data.turns, settled.currentTurns);
      if (!validation.valid) {
        throw new InvalidScoutAmountError(validation.error!);
      }

      const prostituteHappiness = calculateProstituteHappiness({
        prostitutes: player.prostitutes,
        thugs: player.thugs,
        hash: player.hash,
        condoms: player.condoms,
        prostitutePayoutPercent: player.prostitutePayoutPercent,
      }).score;

      const thugHappiness = calculateThugHappiness({
        thugs: player.thugs,
        glocks: player.glocks,
        uzis: player.uzis,
        aks: player.aks,
        beer: player.beer,
      }).score;

      const districtModifiers = player.district.modifiers as unknown as DistrictModifiers;
      const seed = deriveScoutSeed(playerId, idempotencyKey);

      const scoutOutcome = resolveScouting({
        turnsSpent: parsed.data.turns,
        districtModifiers,
        areaSlug: parsed.data.areaSlug,
        prostituteHappiness,
        thugHappiness,
        prostituteCount: player.prostitutes,
        thugCount: player.thugs,
        prostitutePayoutPercent: player.prostitutePayoutPercent,
        seed,
      });

      const { newState } = consumeTurns(settled, parsed.data.turns, now);

      const beforeResources = playerToResources(player);
      const newProstitutes = Math.max(0, player.prostitutes + scoutOutcome.prostitutesFound - scoutOutcome.prostitutesLost);
      const newThugs = Math.max(0, player.thugs + scoutOutcome.thugsFound - scoutOutcome.thugsLost);
      const newCash = player.cash + scoutOutcome.cashEarned;

      const afterResources = {
        ...beforeResources,
        cash: newCash,
        prostitutes: newProstitutes,
        thugs: newThugs,
      };

      const newProstituteHappiness = calculateProstituteHappiness({
        prostitutes: newProstitutes,
        thugs: newThugs,
        hash: player.hash,
        condoms: player.condoms,
        prostitutePayoutPercent: player.prostitutePayoutPercent,
      }).score;

      const newThugHappiness = calculateThugHappiness({
        thugs: newThugs,
        glocks: player.glocks,
        uzis: player.uzis,
        aks: player.aks,
        beer: player.beer,
      }).score;

      const updatedPlayer = await tx.player.update({
        where: { id: playerId },
        data: {
          cash: newCash,
          prostitutes: newProstitutes,
          thugs: newThugs,
          prostituteHappiness: newProstituteHappiness,
          thugHappiness: newThugHappiness,
        },
      });

      await tx.playerTurnState.update({
        where: { playerId },
        data: {
          currentTurns: newState.currentTurns,
          lastRegeneratedAt: newState.lastRegeneratedAt,
        },
      });

      await tx.scoutResult.create({
        data: {
          playerId,
          districtId: player.districtId,
          turnsSpent: parsed.data.turns,
          prostitutesFound: scoutOutcome.prostitutesFound,
          thugsFound: scoutOutcome.thugsFound,
          cashEarned: scoutOutcome.cashEarned,
          prostitutesLost: scoutOutcome.prostitutesLost,
          thugsLost: scoutOutcome.thugsLost,
        },
      });

      const nwChange = netWorthDelta(beforeResources, afterResources);
      const newNetWorth = calculateNetWorth(afterResources);

      const resultData: ScoutResultData = {
        turnsSpent: parsed.data.turns,
        prostitutesFound: scoutOutcome.prostitutesFound,
        thugsFound: scoutOutcome.thugsFound,
        cashEarned: scoutOutcome.cashEarned,
        prostitutesLost: scoutOutcome.prostitutesLost,
        thugsLost: scoutOutcome.thugsLost,
        netWorthChange: nwChange,
        newNetWorth,
        newTurns: newState.currentTurns,
        summary: scoutOutcome.summary,
        newCash,
        newProstitutes,
        newThugs,
      };

      await tx.gameAction.create({
        data: {
          playerId,
          seasonId: player.seasonId,
          actionType: 'SCOUT',
          idempotencyKey,
          requestPayload: { turns: parsed.data.turns },
          resultPayload: resultData as object,
          turnsSpent: parsed.data.turns,
        },
      });

      await tx.economicAuditLog.create({
        data: {
          playerId,
          userId: session.user.id,
          eventType: 'SCOUT',
          source: 'scouting',
          beforeState: snapshotPlayerState(player) as object,
          delta: {
            turns: -parsed.data.turns,
            cash: scoutOutcome.cashEarned,
            prostitutes: scoutOutcome.prostitutesFound - scoutOutcome.prostitutesLost,
            thugs: scoutOutcome.thugsFound - scoutOutcome.thugsLost,
          },
          afterState: snapshotPlayerState(updatedPlayer) as object,
          metadata: { idempotencyKey, summary: scoutOutcome.summary },
        },
      });

      await tx.rankSnapshot.create({
        data: {
          playerId,
          seasonId: player.seasonId,
          netWorth: newNetWorth,
          rank: 0,
        },
      });

      return resultData;
    }, {
      isolationLevel: 'Serializable',
    });

    return { success: true, data: result };
  } catch (error) {
    if (error instanceof DuplicateActionError) {
      return { success: false, error: error.message };
    }
    console.error('Scout error:', error);
    return { success: false, error: toUserMessage(error) };
  }
}
