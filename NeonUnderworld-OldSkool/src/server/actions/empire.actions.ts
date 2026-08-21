'use server';

import { updatePayoutAction as coreUpdatePayoutAction } from '@core/server/actions/empire.actions';
import type { ActionResult } from '@core/server/actions/auth.actions';
import { auth } from '@local/lib/auth/config';
import { ActivityService } from '@local/server/services/activity.service';
import { ACTIVITY_TYPES } from '@local/config/activity-types';
import { OS_TERMS } from '@local/config/terminology';
import { validatePayoutPercent } from '@local/server/domain/empire-calculations';
import { prisma } from '@core/lib/db/prisma';
import { finalizeLocalMutationShell } from '@local/server/services/shell-snapshot.service';
import type { WithPlayerShell } from '@local/domain/player-shell.model';

export async function updatePayoutAction(
  payoutPercent: number,
): Promise<
  ActionResult<
    WithPlayerShell<{
      payoutPercent: number;
      prostituteHappiness: number;
    }>
  >
> {
  const validationError = validatePayoutPercent(payoutPercent);
  if (validationError) {
    return { success: false, error: validationError };
  }

  const result = await coreUpdatePayoutAction(payoutPercent);

  if (result.success) {
    const session = await auth();
    const playerId = session?.user?.playerId;
    if (playerId) {
      await ActivityService.record(
        playerId,
        ACTIVITY_TYPES.WORKER_PAYOUT_UPDATED,
        `${OS_TERMS.specialist} payout updated to ${result.data.payoutPercent}%. Estimated morale: ${result.data.prostituteHappiness}%.`,
        {
          payoutPercent: result.data.payoutPercent,
          estimatedMorale: result.data.prostituteHappiness,
        },
      );
      const player = await prisma.player.findUniqueOrThrow({
        where: { id: playerId },
        include: { district: true, turnState: true },
      });
      const shell = await finalizeLocalMutationShell(playerId, player, ['/empire', '/command']);
      return {
        success: true,
        data: {
          ...result.data,
          shell,
        },
      };
    }
    return { success: false, error: 'Not authenticated' };
  }

  return result;
}

export async function previewPayoutAction(proposedPayout: number) {
  const session = await auth();
  if (!session?.user?.playerId) {
    return { success: false as const, error: 'Not authenticated' };
  }

  const validationError = validatePayoutPercent(proposedPayout);
  if (validationError) {
    return { success: false as const, error: validationError };
  }

  const { prisma } = await import('@core/lib/db/prisma');
  const { previewPayoutMorale } = await import('@local/server/domain/empire-calculations');

  const player = await prisma.player.findUniqueOrThrow({
    where: { id: session.user.playerId },
  });

  const preview = previewPayoutMorale(
    {
      thugs: player.thugs,
      prostitutes: player.prostitutes,
      glocks: player.glocks,
      uzis: player.uzis,
      aks: player.aks,
      rides: player.rides,
      hash: player.hash,
      shrooms: player.shrooms,
      coke: player.coke,
      heroin: player.heroin,
      businesses: player.businesses,
      condoms: player.condoms,
      beer: player.beer,
      prostitutePayoutPercent: player.prostitutePayoutPercent,
    },
    proposedPayout,
  );

  return {
    success: true as const,
    data: {
      currentPayout: player.prostitutePayoutPercent,
      proposedPayout,
      ...preview,
    },
  };
}
