'use server';

import { prisma } from '@/lib/db/prisma';
import { requirePlayer } from '@/lib/auth/session';
import { produceSchema } from '@/lib/validation/schemas';
import { settleTurnRegeneration, consumeTurns } from '@/lib/game-engine/turns';
import {
  resolveProduction,
  validateProductionAmount,
  type ProductionDrug,
} from '@/lib/game-engine/production';
import {
  calculateProstituteHappiness,
  calculateThugHappiness,
} from '@/lib/game-engine/happiness';
import { deriveScoutSeed } from '@/lib/game-engine/rng';
import { calculateNetWorth, netWorthDelta } from '@/lib/game-engine/net-worth';
import { playerToResources, snapshotPlayerState } from '@/lib/game-engine/state';
import { PRODUCTION_CONFIG } from '@/config/game/balance';
import { workerCashBreakdown } from '@/lib/game-engine/worker-economics';
import {
  InvalidScoutAmountError,
  SeasonInactiveError,
} from '@/lib/game-engine/errors';
import { assertPlayerCanPerformAction } from '@/lib/game-engine/player-action-guard';
import { OfflineProtectionService } from '@/server/services/offline-protection.service';
import { GameplayError, toUserMessage } from '@/lib/game-engine/gameplay-errors';
import { CartelService } from '@/server/services/cartel.service';
import { resolveSupplyConsumptionForAction } from '@/lib/game-engine/supply-consumption';
import type { ActionResult } from './auth.actions';

export interface ProduceResultData {
  turnsSpent: number;
  drugType: ProductionDrug;
  drugUnitsProduced: number;
  cashEarned: number;
  cartelContribution?: number;
  workerRevenueGross: number;
  workerPayoutShare: number;
  playerShare: number;
  playerShareBeforeCartel: number;
  payoutPercent: number;
  prostitutesLost: number;
  thugsLost: number;
  netWorthChange: number;
  newNetWorth: number;
  newTurns: number;
  summary: string;
  newCash: number;
  suppliesUsed?: { condoms?: number; hash?: number; beer?: number };
  workerMoraleBefore?: number;
  workerMoraleAfter?: number;
  thugMoraleBefore?: number;
  thugMoraleAfter?: number;
}

export async function produceAction(
  turns: number,
  drugType: ProductionDrug,
  idempotencyKey: string,
): Promise<ActionResult<ProduceResultData>> {
  try {
    const session = await requirePlayer();
    const parsed = produceSchema.safeParse({ turns, drugType, idempotencyKey });
    if (!parsed.success) {
      return { success: false, error: parsed.error.issues[0]?.message ?? 'Invalid input' };
    }

    const playerId = session.user.playerId!;

    const existing = await prisma.gameAction.findUnique({
      where: { playerId_idempotencyKey: { playerId, idempotencyKey } },
    });
    if (existing?.resultPayload) {
      return { success: true, data: existing.resultPayload as unknown as ProduceResultData };
    }

    const result = await prisma.$transaction(async (tx) => {
      const player = await tx.player.findUniqueOrThrow({
        where: { id: playerId },
        include: { turnState: true, season: true },
      });

      if (player.season.status !== 'ACTIVE') throw new SeasonInactiveError();
      assertPlayerCanPerformAction(player);
      await OfflineProtectionService.resetProtectionCycleInTx(tx, playerId);
      if (player.thugs < 1) throw new GameplayError('INVALID_FORCE', 'You need thugs to produce.');
      if (!player.turnState) throw new Error('Turn state not found');

      const workerMoraleBefore = calculateProstituteHappiness({
        prostitutes: player.prostitutes,
        thugs: player.thugs,
        hash: player.hash,
        condoms: player.condoms,
        prostitutePayoutPercent: player.prostitutePayoutPercent,
      }).score;
      const thugMoraleBefore = calculateThugHappiness({
        thugs: player.thugs,
        glocks: player.glocks,
        uzis: player.uzis,
        aks: player.aks,
        beer: player.beer,
      }).score;

      const supplyResult = resolveSupplyConsumptionForAction({
        prostitutes: player.prostitutes,
        thugs: player.thugs,
        turnsSpent: parsed.data.turns,
        condoms: player.condoms,
        hash: player.hash,
        beer: player.beer,
      });
      const suppliesAfter = supplyResult.inventoryAfter;

      const now = new Date();
      const settled = settleTurnRegeneration(
        {
          currentTurns: player.turnState.currentTurns,
          lastRegeneratedAt: player.turnState.lastRegeneratedAt,
          turnCap: player.turnState.turnCap,
          regenerationRatePerMs: player.turnState.regenerationRate,
        },
        now,
      );

      const validation = validateProductionAmount(parsed.data.turns, settled.currentTurns);
      if (!validation.valid) {
        if (validation.error === 'Insufficient turns') {
          throw new GameplayError('INSUFFICIENT_TURNS');
        }
        throw new InvalidScoutAmountError(validation.error!);
      }

      const prostituteHappiness = calculateProstituteHappiness({
        prostitutes: player.prostitutes,
        thugs: player.thugs,
        hash: suppliesAfter.hash,
        condoms: suppliesAfter.condoms,
        prostitutePayoutPercent: player.prostitutePayoutPercent,
      }).score;

      const thugHappiness = calculateThugHappiness({
        thugs: player.thugs,
        glocks: player.glocks,
        uzis: player.uzis,
        aks: player.aks,
        beer: suppliesAfter.beer,
      }).score;

      const seed = deriveScoutSeed(playerId, idempotencyKey);
      const outcome = resolveProduction({
        turnsSpent: parsed.data.turns,
        thugCount: player.thugs,
        prostituteCount: player.prostitutes,
        prostituteHappiness,
        thugHappiness,
        prostitutePayoutPercent: player.prostitutePayoutPercent,
        drugType: parsed.data.drugType,
        seed,
      });

      const { newState } = consumeTurns(settled, parsed.data.turns, now);
      const beforeResources = playerToResources(player);

      const drugField = parsed.data.drugType as keyof typeof beforeResources;
      const newDrugCount = (beforeResources[drugField] as number) + outcome.drugUnitsProduced;
      const newProstitutes = Math.max(0, player.prostitutes - outcome.prostitutesLost);
      const newThugs = Math.max(0, player.thugs - outcome.thugsLost);
      const incomeSplit = await CartelService.applyIncomeContribution(
        tx,
        playerId,
        outcome.cashEarned,
      );
      const newCash = player.cash + incomeSplit.playerCash;

      const afterResources = {
        ...beforeResources,
        cash: newCash,
        prostitutes: newProstitutes,
        thugs: newThugs,
        [parsed.data.drugType]: newDrugCount,
      };

      const newProstituteHappiness = calculateProstituteHappiness({
        prostitutes: newProstitutes,
        thugs: newThugs,
        hash: suppliesAfter.hash,
        condoms: suppliesAfter.condoms,
        prostitutePayoutPercent: player.prostitutePayoutPercent,
      }).score;

      const newThugHappiness = calculateThugHappiness({
        thugs: newThugs,
        glocks: player.glocks,
        uzis: player.uzis,
        aks: player.aks,
        beer: suppliesAfter.beer,
      }).score;

      const updatedPlayer = await tx.player.update({
        where: { id: playerId },
        data: {
          cash: newCash,
          prostitutes: newProstitutes,
          thugs: newThugs,
          condoms: suppliesAfter.condoms,
          hash: suppliesAfter.hash,
          beer: suppliesAfter.beer,
          [parsed.data.drugType]: newDrugCount,
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

      const nwChange = netWorthDelta(beforeResources, afterResources);
      const newNetWorth = calculateNetWorth(afterResources);
      const workerCash = workerCashBreakdown(
        player.prostitutes,
        parsed.data.turns,
        player.prostitutePayoutPercent,
        PRODUCTION_CONFIG.cashPerProstitutePerTurn,
      );

      const resultData: ProduceResultData = {
        turnsSpent: parsed.data.turns,
        drugType: parsed.data.drugType,
        drugUnitsProduced: outcome.drugUnitsProduced,
        cashEarned: incomeSplit.playerCash,
        cartelContribution: incomeSplit.cartelCash,
        workerRevenueGross: workerCash.gross,
        workerPayoutShare: workerCash.workerShare,
        playerShare: workerCash.playerShare,
        playerShareBeforeCartel: outcome.cashEarned,
        payoutPercent: player.prostitutePayoutPercent,
        prostitutesLost: outcome.prostitutesLost,
        thugsLost: outcome.thugsLost,
        netWorthChange: nwChange,
        newNetWorth,
        newTurns: newState.currentTurns,
        summary: outcome.summary,
        newCash,
        suppliesUsed: supplyResult.plan.consumed,
        workerMoraleBefore,
        workerMoraleAfter: newProstituteHappiness,
        thugMoraleBefore,
        thugMoraleAfter: newThugHappiness,
      };

      await tx.gameAction.create({
        data: {
          playerId,
          seasonId: player.seasonId,
          actionType: 'PRODUCTION',
          idempotencyKey,
          requestPayload: { turns: parsed.data.turns, drugType: parsed.data.drugType },
          resultPayload: resultData as object,
          turnsSpent: parsed.data.turns,
        },
      });

      await tx.economicAuditLog.create({
        data: {
          playerId,
          userId: session.user.id,
          eventType: 'PRODUCTION',
          source: 'production',
          beforeState: snapshotPlayerState(player) as object,
          delta: {
            turns: -parsed.data.turns,
            cash: outcome.cashEarned,
            [parsed.data.drugType]: outcome.drugUnitsProduced,
            prostitutes: -outcome.prostitutesLost,
            thugs: -outcome.thugsLost,
          },
          afterState: snapshotPlayerState(updatedPlayer) as object,
          metadata: { idempotencyKey, summary: outcome.summary },
        },
      });

      await tx.rankSnapshot.create({
        data: { playerId, seasonId: player.seasonId, netWorth: newNetWorth, rank: 0 },
      });

      return resultData;
    }, { isolationLevel: 'Serializable' });

    return { success: true, data: result };
  } catch (error) {
    console.error('Produce error:', error);
    return { success: false, error: toUserMessage(error) };
  }
}
