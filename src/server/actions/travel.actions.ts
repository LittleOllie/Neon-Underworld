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
import { SeasonInactiveError } from '@/lib/game-engine/errors';
import { GameplayError, toUserMessage } from '@/lib/game-engine/gameplay-errors';
import { assertPlayerCanPerformAction } from '@/lib/game-engine/player-action-guard';
import type { ActionResult } from './auth.actions';

export interface TravelResult {
  destinationSlug: string;
  destinationName: string;
  turnsSpent: number;
  newTurns: number;
  message: string;
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
    if (existing?.resultPayload) {
      return { success: true, data: existing.resultPayload as unknown as TravelResult };
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

      if (player.season.status !== 'ACTIVE') throw new SeasonInactiveError();
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

      await tx.gameAction.create({
        data: {
          playerId,
          seasonId: player.seasonId,
          actionType: 'TRAVEL',
          idempotencyKey,
          requestPayload: { destinationDistrictSlug } as object,
          resultPayload: {} as object,
          turnsSpent: turnCost,
        },
      });

      return {
        destinationSlug: destDistrict.slug,
        destinationName: destDistrict.name,
        turnsSpent: turnCost,
        newTurns: newState.currentTurns,
        message: `You travelled to ${destDistrict.name}.`,
      };
    });

    await prisma.gameAction.update({
      where: { playerId_idempotencyKey: { playerId, idempotencyKey } },
      data: { resultPayload: data as object },
    });

    return { success: true, data };
  } catch (error) {
    console.error('Travel error:', error);
    return { success: false, error: toUserMessage(error) };
  }
}