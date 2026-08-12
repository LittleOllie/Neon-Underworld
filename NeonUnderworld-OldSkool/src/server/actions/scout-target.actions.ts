'use server';

import { scoutTargetAction as coreScoutTargetAction, type ScoutTargetResultData } from '@core/server/actions/scout-target.actions';
import type { ActionResult } from '@core/server/actions/auth.actions';
import { auth } from '@local/lib/auth/config';
import { prisma } from '@core/lib/db/prisma';
import { ACTIVITY_TYPES, buildPlayerIntelActivityMessage } from '@local/config/activity-types';
import { ActivityService } from '@local/server/services/activity.service';
import { ReportService } from '@local/server/services/report.service';
import { NetWorthService } from '@local/server/services/net-worth.service';
import { finalizeLocalMutationShell } from '@local/server/services/shell-snapshot.service';
import type { WithPlayerShell } from '@local/domain/player-shell.model';

export type { ScoutTargetResultData };

export interface OldSkoolScoutTargetResult extends ScoutTargetResultData {
  reportId: string;
}

const calculateNetWorth = (player: Parameters<typeof NetWorthService.calculateFromPlayer>[0]) =>
  NetWorthService.calculateFromPlayer(player);

export async function scoutTargetAction(
  targetAlias: string,
  idempotencyKey: string,
): Promise<ActionResult<WithPlayerShell<OldSkoolScoutTargetResult>>> {
  const result = await coreScoutTargetAction(targetAlias, idempotencyKey, calculateNetWorth);
  if (!result.success) return result;

  const session = await auth();
  const playerId = session?.user?.playerId;
  if (!playerId) return { success: false, error: 'Not authenticated' };

  const existingReport = await prisma.report.findFirst({
    where: {
      playerId,
      category: 'SCOUT',
      metadata: { path: ['idempotencyKey'], equals: idempotencyKey },
    },
  });

  if (existingReport) {
    const updated = await prisma.player.findUniqueOrThrow({
      where: { id: playerId },
      include: { district: true, turnState: true },
    });
    const shell = await finalizeLocalMutationShell(playerId, updated, ['/attack', '/reports'], {
      turns: result.data.newTurns,
    });
    return {
      success: true,
      data: { ...result.data, reportId: existingReport.id, shell },
    };
  }

  const reportId = await ReportService.createPlayerIntelReport(
    playerId,
    result.data.intel,
    idempotencyKey,
  );

  await ActivityService.record(
    playerId,
    ACTIVITY_TYPES.SCOUT,
    buildPlayerIntelActivityMessage(result.data.targetAlias),
    { reportId, intel: result.data.intel },
  );

  const updated = await prisma.player.findUniqueOrThrow({
    where: { id: playerId },
    include: { district: true, turnState: true },
  });
  const shell = await finalizeLocalMutationShell(playerId, updated, ['/attack', '/reports', '/command'], {
    turns: result.data.newTurns,
  });

  return {
    success: true,
    data: { ...result.data, reportId, shell },
  };
}
