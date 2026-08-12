'use server';

import {
  sellThugsAction as coreSellThugsAction,
  type SellThugsResultData,
} from '@core/server/actions/sell-thugs.actions';
import type { ActionResult } from '@core/server/actions/auth.actions';
import { auth } from '@local/lib/auth/config';
import { prisma } from '@core/lib/db/prisma';
import { ACTIVITY_TYPES } from '@local/config/activity-types';
import { ActivityService } from '@local/server/services/activity.service';
import { finalizeLocalMutationShell } from '@local/server/services/shell-snapshot.service';
import type { WithPlayerShell } from '@local/domain/player-shell.model';

export type { SellThugsResultData };

export async function sellThugsAction(
  quantity: number,
  idempotencyKey: string,
): Promise<ActionResult<WithPlayerShell<SellThugsResultData>>> {
  const result = await coreSellThugsAction(quantity, idempotencyKey);
  if (!result.success) return result;

  const session = await auth();
  const playerId = session?.user?.playerId;
  if (!playerId) return { success: false, error: 'Not authenticated' };

  await ActivityService.record(
    playerId,
    ACTIVITY_TYPES.SHOP_SELL,
    `You released ${result.data.quantity.toLocaleString()} Thugs for $${result.data.totalPayout.toLocaleString()}.`,
    { sellThugs: result.data },
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
