import { revalidateTag } from 'next/cache';
import { prisma } from '@core/lib/db/prisma';

export function playerRankCacheTag(playerId: string): string {
  return `player-rank-${playerId}`;
}

export function seasonRankingsCacheTag(seasonId: string): string {
  return `season-rankings-${seasonId}`;
}

/** Invalidate cached rank/NW after gameplay mutations. */
export function revalidatePlayerGameplayCache(playerId: string, seasonId: string): void {
  try {
    revalidateTag(playerRankCacheTag(playerId));
    revalidateTag(seasonRankingsCacheTag(seasonId));
  } catch {
    // No-op outside Next.js request context (e.g. unit tests)
  }
}

/** Invalidate caches for multiple players (e.g. market settlement). */
export async function revalidatePlayersGameplayCache(playerIds: string[]): Promise<void> {
  const unique = [...new Set(playerIds)];
  if (unique.length === 0) return;

  try {
    const players = await prisma.player.findMany({
      where: { id: { in: unique } },
      select: { id: true, seasonId: true },
    });
    for (const player of players) {
      revalidatePlayerGameplayCache(player.id, player.seasonId);
    }
  } catch {
    // No-op outside Next.js request context
  }
}
