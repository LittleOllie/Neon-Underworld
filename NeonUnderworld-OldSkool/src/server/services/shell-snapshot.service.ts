import { revalidatePath } from 'next/cache';
import type { PlayerShellSnapshot } from '@local/domain/player-shell.model';
import { prisma } from '@core/lib/db/prisma';
import { TurnService } from '@local/server/services/turn.service';
import { NetWorthService, type PlayerNetWorthRecord } from '@local/server/services/net-worth.service';
import { RankingsService } from '@local/server/services/rankings.service';
import { getUnreadReportCount } from '@local/server/services/report.service';
import {
  revalidatePlayerGameplayCache,
} from '@local/server/services/gameplay-cache';

type PlayerRow = PlayerNetWorthRecord & {
  id: string;
  seasonId: string;
  district?: { name: string } | null;
  turnState?: {
    currentTurns: number;
    lastRegeneratedAt: Date;
    turnCap: number;
    regenerationRate: number;
  } | null;
};

export function revalidatePlayerShellPaths(extraPaths: string[] = []): void {
  try {
    revalidatePath('/', 'layout');
    for (const path of extraPaths) {
      revalidatePath(path);
    }
  } catch {
    // No-op outside Next.js request context (e.g. unit tests)
  }
}

/** Invalidate rank caches and layout shell after a local gameplay mutation. */
export function revalidateAfterLocalMutation(
  playerId: string,
  seasonId: string,
  extraPaths: string[] = [],
): void {
  revalidatePlayerGameplayCache(playerId, seasonId);
  revalidatePlayerShellPaths(extraPaths);
}

export async function buildShellSnapshotFromPlayer(
  player: PlayerRow,
  overrides: Partial<PlayerShellSnapshot> = {},
): Promise<PlayerShellSnapshot> {
  const settled = player.turnState
    ? TurnService.settle({
        currentTurns: player.turnState.currentTurns,
        lastRegeneratedAt: player.turnState.lastRegeneratedAt,
        turnCap: player.turnState.turnCap,
        regenerationRatePerMs: player.turnState.regenerationRate,
      })
    : null;

  const [rank, unreadReports, netWorth] = await Promise.all([
    RankingsService.getPlayerRank(player.id, player.seasonId),
    getUnreadReportCount(player.id),
    overrides.netWorth != null
      ? Promise.resolve(overrides.netWorth)
      : NetWorthService.calculateFromPlayerAsync(player),
  ]);

  return {
    cash: player.cash,
    turns: overrides.turns ?? settled?.currentTurns ?? 0,
    turnCap: overrides.turnCap ?? settled?.turnCap ?? 0,
    netWorth,
    rank: overrides.rank ?? rank,
    district: overrides.district ?? player.district?.name,
    unreadReports: overrides.unreadReports ?? unreadReports,
  };
}

export async function buildShellSnapshotForPlayer(
  playerId: string,
  overrides: Partial<PlayerShellSnapshot> = {},
): Promise<PlayerShellSnapshot> {
  const player = await prisma.player.findUniqueOrThrow({
    where: { id: playerId },
    include: { district: true, turnState: true },
  });
  return buildShellSnapshotFromPlayer(player, overrides);
}

export async function finalizeLocalMutationShell(
  playerId: string,
  player: PlayerRow,
  extraPaths: string[] = [],
  overrides: Partial<PlayerShellSnapshot> = {},
): Promise<PlayerShellSnapshot> {
  revalidateAfterLocalMutation(playerId, player.seasonId, extraPaths);
  return buildShellSnapshotFromPlayer(player, overrides);
}
