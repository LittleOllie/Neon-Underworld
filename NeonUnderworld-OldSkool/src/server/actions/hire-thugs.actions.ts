'use server';

import {
  hireThugsAction as coreHireThugsAction,
  type HireThugsResultData,
} from '@core/server/actions/hire-thugs.actions';
import type { ActionResult } from '@core/server/actions/auth.actions';
import { auth } from '@local/lib/auth/config';
import { prisma } from '@core/lib/db/prisma';
import { toUserMessage } from '@core/lib/game-engine/gameplay-errors';
import { ACTIVITY_TYPES } from '@local/config/activity-types';
import { ActivityService } from '@local/server/services/activity.service';
import { EmpireService } from '@local/server/services/empire.service';
import { finalizeLocalMutationShell } from '@local/server/services/shell-snapshot.service';
import type { WithPlayerShell } from '@local/domain/player-shell.model';

export type { HireThugsResultData };

export async function hireThugsAction(
  quantity: number,
  idempotencyKey: string,
): Promise<ActionResult<WithPlayerShell<HireThugsResultData>>> {
  try {
    const result = await coreHireThugsAction(quantity, idempotencyKey);
    if (!result.success) return result;

    const session = await auth();
    const playerId = session?.user?.playerId;
    if (!playerId) return { success: false, error: 'Not authenticated' };

    await EmpireService.syncInventory(playerId);

    const updated = await prisma.player.findUniqueOrThrow({
      where: { id: playerId },
      include: { district: true, turnState: true },
    });
    const shell = await finalizeLocalMutationShell(playerId, updated, ['/shop', '/empire'], {
      cash: result.data.newCash,
      netWorth: result.data.canonicalNetWorth,
    });

    await ActivityService.record(
      playerId,
      ACTIVITY_TYPES.SHOP_PURCHASE,
      `You hired ${result.data.quantity.toLocaleString()} Thugs for $${result.data.totalCost.toLocaleString()}.`,
      { hireThugs: result.data },
    );

    return {
      success: true,
      data: {
        ...result.data,
        newNetWorth: shell.netWorth,
        canonicalNetWorth: shell.netWorth,
        shell,
      },
    };
  } catch (error) {
    console.error('Hire thugs wrapper error:', error);
    return { success: false, error: toUserMessage(error) };
  }
}
