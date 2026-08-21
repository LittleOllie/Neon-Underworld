import type { Prisma, PrismaClient } from '@prisma/client';
import { SeasonStatus } from '@prisma/client';

type PlaytestNpcDb = PrismaClient | Prisma.TransactionClient;

export const PLAYTEST_NPC_EMAIL_PREFIX = 'playtest-npc+' as const;

export interface ActiveSeasonRef {
  id: string;
  number: number;
}

export interface PlaytestNpcSeasonReattachResult {
  activeSeason: ActiveSeasonRef;
  moved: number;
  alreadyOnActive: number;
  totalPlaytestNpcs: number;
  previousSeasons: Array<{ seasonId: string; seasonNumber: number; count: number }>;
}

export class PlaytestNpcSeasonError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PlaytestNpcSeasonError';
  }
}

/** Requires exactly one ACTIVE season — aborts when ambiguous or missing. */
export async function requireExactlyOneActiveSeason(
  prisma: PlaytestNpcDb,
): Promise<ActiveSeasonRef> {
  const activeSeasons = await prisma.season.findMany({
    where: { status: SeasonStatus.ACTIVE },
    orderBy: { number: 'desc' },
    select: { id: true, number: true },
  });

  if (activeSeasons.length === 0) {
    throw new PlaytestNpcSeasonError('No active season found — cannot reattach playtest NPCs.');
  }
  if (activeSeasons.length > 1) {
    throw new PlaytestNpcSeasonError(
      `Expected exactly one active season, found ${activeSeasons.length}: ${activeSeasons.map((s) => s.number).join(', ')}`,
    );
  }

  return activeSeasons[0]!;
}

/**
 * Reattach all playtest-npc+ players to the current active season.
 * Updates seasonId only — assets, progression, districts, and history are preserved.
 */
export async function reattachPlaytestNpcsToActiveSeason(
  prisma: PlaytestNpcDb,
  activeSeason?: ActiveSeasonRef,
): Promise<PlaytestNpcSeasonReattachResult> {
  const season = activeSeason ?? (await requireExactlyOneActiveSeason(prisma));

  const playtestPlayers = await prisma.player.findMany({
    where: {
      user: { email: { startsWith: PLAYTEST_NPC_EMAIL_PREFIX } },
    },
    select: { id: true, seasonId: true },
  });

  const toMove = playtestPlayers.filter((p) => p.seasonId !== season.id);
  const alreadyOnActive = playtestPlayers.length - toMove.length;

  const previousBySeason = new Map<string, number>();
  for (const player of toMove) {
    previousBySeason.set(player.seasonId, (previousBySeason.get(player.seasonId) ?? 0) + 1);
  }

  const previousSeasonIds = [...previousBySeason.keys()];
  const previousSeasonMeta =
    previousSeasonIds.length > 0
      ? await prisma.season.findMany({
          where: { id: { in: previousSeasonIds } },
          select: { id: true, number: true },
        })
      : [];
  const numberById = new Map(previousSeasonMeta.map((s) => [s.id, s.number]));

  if (toMove.length > 0) {
    await prisma.player.updateMany({
      where: { id: { in: toMove.map((p) => p.id) } },
      data: { seasonId: season.id },
    });
  }

  return {
    activeSeason: season,
    moved: toMove.length,
    alreadyOnActive,
    totalPlaytestNpcs: playtestPlayers.length,
    previousSeasons: previousSeasonIds.map((seasonId) => ({
      seasonId,
      seasonNumber: numberById.get(seasonId) ?? -1,
      count: previousBySeason.get(seasonId) ?? 0,
    })),
  };
}

/** Dev-only — bust Rankings unstable_cache via local Next server (no-op if unreachable). */
export async function tryRevalidateRankingsCache(seasonId: string): Promise<boolean> {
  const port = process.env.PORT ?? '3302';
  const url = `http://localhost:${port}/api/dev/revalidate-rankings`;
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ seasonId }),
    });
    return res.ok;
  } catch {
    return false;
  }
}
