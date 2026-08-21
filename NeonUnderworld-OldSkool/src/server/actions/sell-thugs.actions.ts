'use server';

import {
  sellThugsAction as coreSellThugsAction,
  type SellThugsResultData,
} from '@core/server/actions/sell-thugs.actions';
import type { ActionResult } from '@core/server/actions/auth.actions';
import { auth } from '@local/lib/auth/config';
import { prisma } from '@core/lib/db/prisma';
import { toUserMessage } from '@core/lib/game-engine/gameplay-errors';
import { OS_TERMS } from '@local/config/terminology';
import { ACTIVITY_TYPES } from '@local/config/activity-types';
import { ActivityService } from '@local/server/services/activity.service';
import { EmpireService } from '@local/server/services/empire.service';
import { finalizeLocalMutationShell } from '@local/server/services/shell-snapshot.service';
import type { WithPlayerShell } from '@local/domain/player-shell.model';

export type { SellThugsResultData };

export async function sellThugsAction(
  quantity: number,
  idempotencyKey: string,
): Promise<ActionResult<WithPlayerShell<SellThugsResultData>>> {
  try {
    const result = await coreSellThugsAction(quantity, idempotencyKey);
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
      ACTIVITY_TYPES.SHOP_SELL,
      `You released ${result.data.quantity.toLocaleString()} ${OS_TERMS.enforcers} for $${result.data.totalPayout.toLocaleString()}.`,
      { sellThugs: result.data },
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
    console.error('Sell thugs wrapper error:', error);
    return { success: false, error: toUserMessage(error) };
  }
}
