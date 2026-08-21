'use server';

import { prisma } from '@/lib/db/prisma';
import { requirePlayer } from '@/lib/auth/session';
import { REDLITE_TRAVEL } from '@/config/game/redlite-rules';
import { DISTRICTS } from '@/config/game/balance';
import {
  ridesRequiredForTravel,
  travelCrewPopulation,
  validateTravelDestination,
} from '@/lib/game-engine/travel';
import {
  consumeTurns,
  resolveCanonicalTurnState,
  settleTurnRegeneration,
} from '@/lib/game-engine/turns';
import { assertGameplaySeasonActive } from '@/lib/game-engine/season-guard';
import { GameplayError, toUserMessage } from '@/lib/game-engine/gameplay-errors';
import { assertPlayerCanPerformAction } from '@/lib/game-engine/player-action-guard';
import type { ActionResult } from './auth.actions';

export interface TravelResult {
  destinationSlug: string;
  destinationName: string;
  turnsSpent: number;
  newTurns: number;
  ridesRequired: number;
  ridesRemaining: number;
  message: string;
}

function isCompletedTravelPayload(payload: unknown): payload is TravelResult {
  return (
    typeof payload === 'object' &&
    payload !== null &&
    'destinationSlug' in payload &&
    typeof (payload as TravelResult).destinationSlug === 'string' &&
    (payload as TravelResult).destinationSlug.length > 0
  );
}

export async function travelAction(
  destinationDistrictSlug: string,
  idempotencyKey: string,
): Promise<ActionResult<TravelResult>> {
  try {
    const session = await requirePlayer();
    const playerId = session.user.playerId!;

    const existing = await prisma.gameAction.findUnique({
      where: { playerId_idempotencyKey: { playerId, idempotencyKey } },
    });
    if (existing && isCompletedTravelPayload(existing.resultPayload)) {
      return { success: true, data: existing.resultPayload };
    }

    const destination = DISTRICTS.find((d) => d.slug === destinationDistrictSlug);
    if (!destination) {
      return { success: false, error: 'Invalid destination.' };
    }

    const data = await prisma.$transaction(async (tx) => {
      const player = await tx.player.findUniqueOrThrow({
        where: { id: playerId },
        include: { turnState: true, district: true, season: true },
      });

      assertGameplaySeasonActive(player.season);
      assertPlayerCanPerformAction(player);

      if (player.travelling) {
        throw new GameplayError('TRAVEL_IN_PROGRESS');
      }

      if (!validateTravelDestination(player.district.slug, destination.slug)) {
        throw new GameplayError('TRAVEL_ALREADY_THERE');
      }

      const destDistrict = await tx.district.findUniqueOrThrow({
        where: { slug: destination.slug },
      });

      const crew = travelCrewPopulation(player.thugs, player.prostitutes);
      const ridesNeeded = ridesRequiredForTravel(crew);
      if (player.rides < ridesNeeded) {
        throw new GameplayError(
          'INSUFFICIENT_RIDES',
          `You need ${ridesNeeded - player.rides} more rides to travel.`,
        );
      }

      if (!player.turnState) throw new GameplayError('INSUFFICIENT_TURNS');

      const settled = settleTurnRegeneration(
        resolveCanonicalTurnState({
          currentTurns: player.turnState.currentTurns,
          lastRegeneratedAt: player.turnState.lastRegeneratedAt,
          turnCap: player.turnState.turnCap,
          regenerationRatePerMs: player.turnState.regenerationRate,
        }),
      );

      const turnCost = REDLITE_TRAVEL.turnCost;
      if (settled.currentTurns < turnCost) {
        throw new GameplayError('INSUFFICIENT_TURNS');
      }

      const { newState } = consumeTurns(settled, turnCost);

      await tx.player.update({
        where: { id: playerId },
        data: {
          districtId: destDistrict.id,
          travelling: false,
          travelDestination: null,
          travelArrival: null,
          lifeStatus: 'ACTIVE',
        },
      });

      await tx.playerTurnState.update({
        where: { playerId },
        data: {
          currentTurns: newState.currentTurns,
          lastRegeneratedAt: newState.lastRegeneratedAt,
        },
      });

      const resultData: TravelResult = {
        destinationSlug: destDistrict.slug,
        destinationName: destDistrict.name,
        turnsSpent: turnCost,
        newTurns: newState.currentTurns,
        ridesRequired: ridesNeeded,
        ridesRemaining: player.rides,
        message: `You travelled to ${destDistrict.name}.`,
      };

      await tx.gameAction.create({
        data: {
          playerId,
          seasonId: player.seasonId,
          actionType: 'TRAVEL',
          idempotencyKey,
          requestPayload: { destinationDistrictSlug } as object,
          resultPayload: resultData as object,
          turnsSpent: turnCost,
        },
      });

      return resultData;
    });

    return { success: true, data };
  } catch (error) {
    console.error('Travel error:', error);
    return { success: false, error: toUserMessage(error) };
  }
}
