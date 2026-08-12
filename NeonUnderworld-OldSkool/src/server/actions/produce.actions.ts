'use server';

import { produceAction as coreProduceAction, type ProduceResultData } from '@core/server/actions/produce.actions';
import type { ActionResult } from '@core/server/actions/auth.actions';
import { auth } from '@local/lib/auth/config';
import { prisma } from '@core/lib/db/prisma';
import { ACTIVITY_TYPES } from '@local/config/activity-types';
import { ActivityService } from '@local/server/services/activity.service';
import { EmpireService } from '@local/server/services/empire.service';
import { finalizeLocalMutationShell } from '@local/server/services/shell-snapshot.service';
import type { WithPlayerShell } from '@local/domain/player-shell.model';
import type { ProductionDrug } from '@core/lib/game-engine/production';

export type { ProduceResultData };

export interface OldSkoolProduceResult extends ProduceResultData {
  canonicalNetWorth: number;
}

export async function produceAction(
  turns: number,
  drugType: ProductionDrug,
  idempotencyKey: string,
): Promise<ActionResult<WithPlayerShell<OldSkoolProduceResult>>> {
  const result = await coreProduceAction(turns, drugType, idempotencyKey);
  if (!result.success) return result;

  const session = await auth();
  const playerId = session?.user?.playerId;
  if (!playerId) return { success: false, error: 'Not authenticated' };

  await EmpireService.syncInventory(playerId);
  const updated = await prisma.player.findUniqueOrThrow({
    where: { id: playerId },
    include: { district: true, turnState: true },
  });
  const shell = await finalizeLocalMutationShell(playerId, updated, ['/produce', '/command'], {
    turns: result.data.newTurns,
    netWorth: result.data.newNetWorth,
  });

  await ActivityService.record(
    playerId,
    ACTIVITY_TYPES.PRODUCTION,
    `Production complete: +${result.data.drugUnitsProduced} ${result.data.drugType}, +$${result.data.cashEarned.toLocaleString()} cash.`,
    { production: result.data },
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
}
