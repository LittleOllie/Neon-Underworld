'use server';

import { scoutAction as coreScoutAction, type ScoutResultData } from '@core/server/actions/scout.actions';
import type { ActionResult } from '@core/server/actions/auth.actions';
import { auth } from '@local/lib/auth/config';
import { prisma } from '@core/lib/db/prisma';
import { ACTIVITY_TYPES, buildScoutActivityMessage } from '@local/config/activity-types';
import { ActivityService } from '@local/server/services/activity.service';
import { EmpireService } from '@local/server/services/empire.service';
import { NetWorthService } from '@local/server/services/net-worth.service';
import { revalidatePlayerGameplayCache } from '@local/server/services/gameplay-cache';

export type { ScoutResultData };

export interface OldSkoolScoutResult extends ScoutResultData {
  canonicalNetWorth: number;
}

export async function scoutAction(
  turns: number,
  idempotencyKey: string,
  areaSlug?: string,
): Promise<ActionResult<OldSkoolScoutResult>> {
  const result = await coreScoutAction(turns, idempotencyKey, areaSlug);

  if (!result.success) {
    return result;
  }

  const session = await auth();
  const playerId = session?.user?.playerId;
  if (!playerId) {
    return { success: false, error: 'Not authenticated' };
  }

  await EmpireService.syncInventory(playerId);

  const updated = await prisma.player.findUniqueOrThrow({
    where: { id: playerId },
    include: { district: true },
  });

  const canonicalNetWorth = NetWorthService.calculateFromPlayer(updated);

  await ActivityService.record(
    playerId,
    ACTIVITY_TYPES.SCOUT,
    buildScoutActivityMessage(result.data),
    { scout: result.data },
  );

  revalidatePlayerGameplayCache(playerId, updated.seasonId);

  return {
    success: true,
    data: {
      ...result.data,
      canonicalNetWorth,
      newNetWorth: canonicalNetWorth,
    },
  };
}
