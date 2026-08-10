'use server';

import { travelAction as coreTravelAction, type TravelResult } from '@core/server/actions/travel.actions';
import type { ActionResult } from '@core/server/actions/auth.actions';
import { REDLITE_TRAVEL } from '@core/config/game/redlite-rules';
import {
  ridesRequiredForTravel,
  travelCrewPopulation,
  travelDestinationsForSlug,
} from '@core/lib/game-engine/travel';
import { auth } from '@local/lib/auth/config';
import { ACTIVITY_TYPES } from '@local/config/activity-types';
import { ActivityService } from '@local/server/services/activity.service';
import type { CanonicalPlayerContext } from '@local/server/services/player.service';
import { prisma } from '@core/lib/db/prisma';
import { revalidatePlayerGameplayCache } from '@local/server/services/gameplay-cache';

export type { TravelResult };

export interface TravelPageData {
  currentCity: string;
  currentSlug: string;
  destinations: Array<{
    slug: string;
    name: string;
    description: string;
  }>;
  ridesOwned: number;
  ridesRequired: number;
  turnCost: number;
  turnsAvailable: number;
  crewPopulation: number;
}

export async function getTravelPageDataFromContext(ctx: CanonicalPlayerContext): Promise<TravelPageData> {
  const crew = travelCrewPopulation(ctx.thugs, ctx.prostitutes);
  return {
    currentCity: ctx.district.name,
    currentSlug: ctx.district.slug,
    destinations: travelDestinationsForSlug(ctx.district.slug),
    ridesOwned: ctx.rides,
    ridesRequired: ridesRequiredForTravel(crew),
    turnCost: REDLITE_TRAVEL.turnCost,
    turnsAvailable: ctx.turns,
    crewPopulation: crew,
  };
}

export async function travelAction(
  destinationDistrictSlug: string,
  idempotencyKey: string,
): Promise<ActionResult<TravelResult>> {
  const result = await coreTravelAction(destinationDistrictSlug, idempotencyKey);
  if (!result.success) return result;

  const session = await auth();
  const playerId = session?.user?.playerId;
  if (playerId) {
    await ActivityService.record(
      playerId,
      ACTIVITY_TYPES.TRAVEL,
      result.data.message,
      { travel: result.data },
    );
    const player = await prisma.player.findUnique({ where: { id: playerId }, select: { seasonId: true } });
    if (player) revalidatePlayerGameplayCache(playerId, player.seasonId);
  }

  return result;
}
