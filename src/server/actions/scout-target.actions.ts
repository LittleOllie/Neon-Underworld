'use server';

import { prisma } from '@/lib/db/prisma';
import { requirePlayer } from '@/lib/auth/session';
import { scoutTargetSchema } from '@/lib/validation/schemas';
import { ATTACK_RULES } from '@/config/game/attack-rules';
import {
  consumeTurns,
  resolveCanonicalTurnState,
  settleTurnRegeneration,
} from '@/lib/game-engine/turns';
import { buildPlayerIntelSnapshot, deriveIntelSeed } from '@/lib/game-engine/combat/build-intel-snapshot';
import type { PlayerIntelSnapshot } from '@/lib/game-engine/combat/eligibility';
import { SeasonInactiveError } from '@/lib/game-engine/errors';
import { assertPlayerCanPerformAction } from '@/lib/game-engine/player-action-guard';
import { GameplayError, toUserMessage } from '@/lib/game-engine/gameplay-errors';
import type { ActionResult } from './auth.actions';

export interface ScoutTargetResultData {
  turnsSpent: number;
  newTurns: number;
  targetAlias: string;
  targetPlayerId: string;
  intel: PlayerIntelSnapshot;
}

export async function scoutTargetAction(
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
): Promise<ActionResult<ScoutTargetResultData>> {
  try {
    const session = await requirePlayer();
    const parsed = scoutTargetSchema.safeParse({ targetAlias, idempotencyKey });
    if (!parsed.success) {
      return { success: false, error: parsed.error.issues[0]?.message ?? 'Invalid input' };
    }

    const playerId = session.user.playerId!;
    const aliasNormalized = parsed.data.targetAlias.trim().toLowerCase();

    const existing = await prisma.gameAction.findUnique({
      where: { playerId_idempotencyKey: { playerId, idempotencyKey } },
    });
    if (existing?.resultPayload) {
      return { success: true, data: existing.resultPayload as unknown as ScoutTargetResultData };
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
      if (target.id === playerId) throw new GameplayError('INVALID_TARGET', 'You cannot scout yourself.');

      const settled = settleTurnRegeneration(
        resolveCanonicalTurnState({
          currentTurns: scout.turnState.currentTurns,
          lastRegeneratedAt: scout.turnState.lastRegeneratedAt,
          turnCap: scout.turnState.turnCap,
          regenerationRatePerMs: scout.turnState.regenerationRate,
        }),
      );

      const turnCost = ATTACK_RULES.scoutIntelTurnCost;
      if (settled.currentTurns < turnCost) {
        throw new GameplayError('INSUFFICIENT_TURNS');
      }

      const { newState } = consumeTurns(settled, turnCost);
      const seed = deriveIntelSeed(playerId, target.id, idempotencyKey);
      const nw = calculateNetWorth(target);
      const intel = buildPlayerIntelSnapshot(
        {
          id: target.id,
          alias: target.alias,
          districtName: target.district.name,
          thugs: target.thugs,
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
        seed,
      );

      await tx.playerTurnState.update({
        where: { playerId },
        data: {
          currentTurns: newState.currentTurns,
          lastRegeneratedAt: newState.lastRegeneratedAt,
        },
      });

      const resultData: ScoutTargetResultData = {
        turnsSpent: turnCost,
        newTurns: newState.currentTurns,
        targetAlias: target.alias,
        targetPlayerId: target.id,
        intel,
      };

      await tx.gameAction.create({
        data: {
          playerId,
          seasonId: scout.seasonId,
          actionType: 'SCOUT_TARGET',
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
    console.error('Scout target error:', error);
    return { success: false, error: toUserMessage(error) };
  }
}
