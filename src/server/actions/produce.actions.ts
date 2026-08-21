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
import { netWorthDelta } from '@/lib/game-engine/net-worth';
import {
  calculatePlayerCanonicalNetWorthWithBusinesses,
} from '@/lib/game-engine/business/net-worth';
import { BUSINESS_NW_SELECT } from '@/server/services/business.service';
import { playerToResources, snapshotPlayerState } from '@/lib/game-engine/state';
import { PRODUCTION_CONFIG } from '@/config/game/balance';
import { getBusinessDrugProductionBonus } from '@/config/game/business-rules';
import { workerCashBreakdown } from '@/lib/game-engine/worker-economics';
import {
  InvalidScoutAmountError,
} from '@/lib/game-engine/errors';
import { assertGameplaySeasonActive } from '@/lib/game-engine/season-guard';
import { assertPlayerCanPerformAction } from '@/lib/game-engine/player-action-guard';
import { GameplayError, toUserMessage } from '@/lib/game-engine/gameplay-errors';
import { CartelService } from '@/server/services/cartel.service';
import { resolveSupplyConsumptionForAction } from '@/lib/game-engine/supply-consumption';
import { resolvePostProduceDrugCounts } from '@/lib/game-engine/produce-economy';
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
  /** Hash inventory delta when drugType is hash (produced − consumed). */
  hashNetChange?: number;
  hashBefore?: number;
  hashAfter?: number;
  workerMoraleBefore?: number;
  workerMoraleAfter?: number;
  thugMoraleBefore?: number;
  thugMoraleAfter?: number;
  /** Extra drug units from Drug Lab business bonuses. */
  businessBonusUnits?: number;
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

      assertGameplaySeasonActive(player.season);
      assertPlayerCanPerformAction(player);
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

      const isHashProduction = parsed.data.drugType === 'hash';

      const supplyResult = resolveSupplyConsumptionForAction({
        prostitutes: player.prostitutes,
        thugs: player.thugs,
        turnsSpent: parsed.data.turns,
        condoms: player.condoms,
        hash: player.hash,
        beer: player.beer,
        exemptWorkerHash: isHashProduction,
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
        exemptHashMorale: isHashProduction,
      }).score;

      const thugHappiness = calculateThugHappiness({
        thugs: player.thugs,
        glocks: player.glocks,
        uzis: player.uzis,
        aks: player.aks,
        beer: suppliesAfter.beer,
      }).score;

      const seed = deriveScoutSeed(playerId, idempotencyKey);
      const drugLabs = await tx.business.findMany({
        where: { playerId, businessType: 'DRUG_LAB' },
        select: { businessType: true, level: true },
      });
      const drugProductionBonus = getBusinessDrugProductionBonus(drugLabs);
      const outcome = resolveProduction({
        turnsSpent: parsed.data.turns,
        thugCount: player.thugs,
        prostituteCount: player.prostitutes,
        prostituteHappiness,
        thugHappiness,
        prostitutePayoutPercent: player.prostitutePayoutPercent,
        drugType: parsed.data.drugType,
        seed,
        drugProductionBonus,
      });

      const { newState } = consumeTurns(settled, parsed.data.turns, now);
      const beforeResources = playerToResources(player);
      const hashBefore = player.hash;

      const drugCounts = resolvePostProduceDrugCounts({
        drugType: parsed.data.drugType,
        drugUnitsProduced: outcome.drugUnitsProduced,
        beforeDrugs: beforeResources,
        suppliesAfter,
      });
      const hashAfter = drugCounts.hash;
      const hashNetChange =
        parsed.data.drugType === 'hash'
          ? outcome.drugUnitsProduced
          : undefined;

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
        ...drugCounts,
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
          beer: suppliesAfter.beer,
          hash: drugCounts.hash,
          shrooms: drugCounts.shrooms,
          coke: drugCounts.coke,
          heroin: drugCounts.heroin,
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
      const businessRows = await tx.business.findMany({
        where: { playerId },
        select: BUSINESS_NW_SELECT,
      });
      const newNetWorth = calculatePlayerCanonicalNetWorthWithBusinesses(updatedPlayer, businessRows);
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
        hashNetChange,
        hashBefore,
        hashAfter,
        workerMoraleBefore,
        workerMoraleAfter: newProstituteHappiness,
        thugMoraleBefore,
        thugMoraleAfter: newThugHappiness,
        ...(outcome.businessBonusUnits > 0
          ? { businessBonusUnits: outcome.businessBonusUnits }
          : {}),
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
