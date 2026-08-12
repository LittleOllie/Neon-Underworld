'use server';

import { scoutAction as coreScoutAction, type ScoutResultData } from '@core/server/actions/scout.actions';
import type { ActionResult } from '@core/server/actions/auth.actions';
import { auth } from '@local/lib/auth/config';
import { prisma } from '@core/lib/db/prisma';
import { toUserMessage } from '@core/lib/game-engine/gameplay-errors';
import { ACTIVITY_TYPES, buildScoutActivityMessage } from '@local/config/activity-types';
import { ActivityService } from '@local/server/services/activity.service';
import { EmpireService } from '@local/server/services/empire.service';
import { finalizeLocalMutationShell } from '@local/server/services/shell-snapshot.service';
import type { WithPlayerShell } from '@local/domain/player-shell.model';

export type { ScoutResultData };

export interface OldSkoolScoutResult extends ScoutResultData {
  canonicalNetWorth: number;
}

export async function scoutAction(
  turns: number,
  idempotencyKey: string,
  areaSlug?: string,
): Promise<ActionResult<WithPlayerShell<OldSkoolScoutResult>>> {
  try {
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
      include: { district: true, turnState: true },
    });

    const shell = await finalizeLocalMutationShell(playerId, updated, ['/scout', '/command'], {
      cash: result.data.newCash,
      turns: result.data.newTurns,
      netWorth: result.data.newNetWorth,
    });

    await ActivityService.record(
      playerId,
      ACTIVITY_TYPES.SCOUT,
      buildScoutActivityMessage(result.data),
      { scout: result.data },
    );

    return {
      success: true,
      data: {
        ...result.data,
        canonicalNetWorth: shell.netWorth,
        newNetWorth: shell.netWorth,
        shell,
      },
    };
  } catch (error) {
    console.error('Scout wrapper error:', error);
    return { success: false, error: toUserMessage(error) };
  }
}
