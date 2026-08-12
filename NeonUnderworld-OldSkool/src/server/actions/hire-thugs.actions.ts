'use server';

import {
  hireThugsAction as coreHireThugsAction,
  type HireThugsResultData,
} from '@core/server/actions/hire-thugs.actions';
import type { ActionResult } from '@core/server/actions/auth.actions';
import { auth } from '@local/lib/auth/config';
import { prisma } from '@core/lib/db/prisma';
import { ACTIVITY_TYPES } from '@local/config/activity-types';
import { ActivityService } from '@local/server/services/activity.service';
import { finalizeLocalMutationShell } from '@local/server/services/shell-snapshot.service';
import type { WithPlayerShell } from '@local/domain/player-shell.model';

export type { HireThugsResultData };

export async function hireThugsAction(
  quantity: number,
  idempotencyKey: string,
): Promise<ActionResult<WithPlayerShell<HireThugsResultData>>> {
  const result = await coreHireThugsAction(quantity, idempotencyKey);
  if (!result.success) return result;

  const session = await auth();
  const playerId = session?.user?.playerId;
  if (!playerId) return { success: false, error: 'Not authenticated' };

  await ActivityService.record(
    playerId,
    ACTIVITY_TYPES.SHOP_PURCHASE,
    `You hired ${result.data.quantity.toLocaleString()} Thugs for $${result.data.totalCost.toLocaleString()}.`,
    { hireThugs: result.data },
  );

  const updated = await prisma.player.findUniqueOrThrow({
    where: { id: playerId },
    include: { district: true, turnState: true },
  });
  const shell = await finalizeLocalMutationShell(playerId, updated, ['/shop', '/empire']);

  return {
    success: true,
    data: {
      ...result.data,
      shell,
    },
  };
}
