import { cache } from 'react';
import { unstable_cache } from 'next/cache';
import { prisma } from '@core/lib/db/prisma';
import { listActivatedHumanPlayerIds } from '@core/lib/db/admin-analytics-db';
import { isAdminSchemaReady } from '@core/lib/db/admin-schema-readiness';
import { NetWorthService, type PlayerNetWorthRecord } from './net-worth.service';
import { PlayerStatusService } from './player-status.service';
import { resolvePlayerAvatarId } from '@core/lib/game-engine/resolve-player-avatar';
import { identityViewFromPlayer } from '@core/lib/game-engine/player-identity-fields';
import type { PlayerIdentityView } from '@core/lib/game-engine/player-identity-fields';
import { isVisibleSeasonParticipant } from '@core/lib/game-engine/human-player';
import {
  playerRankCacheTag,
  seasonRankingsCacheTag,
} from './gameplay-cache';

export type RankingsFilter = 'overall' | 'neon-strip' | 'docklands' | 'old-quarter';

export interface RankingRow {
  id: string;
  rank: number;
  alias: string;
  aliasNormalized: string;
  avatarId: string;
  identity: PlayerIdentityView;
  city: string;
  citySlug: string;
  cartelId: string | null;
  cartelTag: string | null;
  netWorth: number;
  lastSeen: Date | null;
  online: boolean;
  createdAt: Date;
}

const DISTRICT_FILTERS: Record<Exclude<RankingsFilter, 'overall'>, string> = {
  'neon-strip': 'neon-strip',
  docklands: 'docklands',
  'old-quarter': 'old-quarter',
};

const SLUG_TO_FILTER: Record<string, RankingsFilter> = {
  'neon-strip': 'neon-strip',
  docklands: 'docklands',
  'old-quarter': 'old-quarter',
};

/** Map a player district slug to a rankings filter tab (null when unknown). */
export function districtSlugToRankingsFilter(slug: string): RankingsFilter | null {
  return SLUG_TO_FILTER[slug] ?? null;
}

/** Default rankings tab for a player with no explicit ?filter= param. */
export function defaultRankingsFilterForDistrict(slug: string): RankingsFilter {
  return districtSlugToRankingsFilter(slug) ?? 'overall';
}

const RANK_NET_WORTH_SELECT = {
  id: true,
  createdAt: true,
  cash: true,
  bankCash: true,
  prostitutes: true,
  thugs: true,
  rides: true,
  glocks: true,
  uzis: true,
  aks: true,
  hash: true,
  shrooms: true,
  coke: true,
  heroin: true,
  businesses: true,
} as const;

/** Header rank may lag the leaderboard by up to this many seconds after mutations. */
export const PLAYER_RANK_CACHE_SECONDS = 45;
/** Rankings page snapshot TTL — full leaderboard recomputed at most this often. */
export const SEASON_RANKINGS_CACHE_SECONDS = 30;

function compareRankings(
  a: { netWorth: number; createdAt: Date; id: string },
  b: { netWorth: number; createdAt: Date; id: string },
): number {
  if (b.netWorth !== a.netWorth) return b.netWorth - a.netWorth;
  const created = a.createdAt.getTime() - b.createdAt.getTime();
  if (created !== 0) return created;
  return a.id.localeCompare(b.id);
}

async function computeSeasonRankings(
  seasonId: string,
  filter: RankingsFilter = 'overall',
): Promise<RankingRow[]> {
  const districtSlug = filter === 'overall' ? undefined : DISTRICT_FILTERS[filter];

  const players = await prisma.player.findMany({
    where: {
      seasonId,
      isSystemPlayer: false,
      ...(districtSlug ? { district: { slug: districtSlug } } : {}),
    },
    include: {
      district: true,
      cartel: { select: { tag: true } },
      user: { select: { lastLoginAt: true, email: true } },
      statusExt: true,
    },
    orderBy: { createdAt: 'asc' },
  });

  let visiblePlayers = players;
  if (await isAdminSchemaReady()) {
    const activatedIds = new Set(await listActivatedHumanPlayerIds(seasonId));
    visiblePlayers = players.filter((p) =>
      isVisibleSeasonParticipant(
        { id: p.id, isSystemPlayer: p.isSystemPlayer, email: p.user.email },
        activatedIds,
      ),
    );
  }

  const netWorthMap = await NetWorthService.calculateForPlayers(visiblePlayers as PlayerNetWorthRecord[]);

  const enriched = visiblePlayers.map((p) => {
    const lastSeen = PlayerStatusService.resolveLastSeen(
      p.user.lastLoginAt,
      p.statusExt?.lastSeenAt,
      p.updatedAt,
    );
    return {
      id: p.id,
      alias: p.alias,
      aliasNormalized: p.aliasNormalized,
      avatarId: resolvePlayerAvatarId(p.avatar),
      identity: identityViewFromPlayer(p),
      city: p.district.name,
      citySlug: p.district.slug,
      cartelId: p.cartelId,
      cartelTag: p.cartel?.tag ?? null,
      netWorth: netWorthMap.get(p.id) ?? 0,
      lastSeen,
      online: PlayerStatusService.isOnline(lastSeen),
      createdAt: p.createdAt,
    };
  });

  enriched.sort(compareRankings);

  return enriched.map((row, i) => ({ ...row, rank: i + 1 }));
}

const getCachedSeasonRankings = cache((seasonId: string, filter: RankingsFilter) =>
  unstable_cache(
    () => computeSeasonRankings(seasonId, filter),
    ['season-rankings', seasonId, filter],
    { revalidate: SEASON_RANKINGS_CACHE_SECONDS, tags: [seasonRankingsCacheTag(seasonId)] },
  )(),
);

/**
 * Player rank is always derived from a cached season leaderboard snapshot —
 * never an independent full-season scan per lookup.
 *
 * Cache behaviour:
 * - `getSeasonRankings(seasonId, filter)` — shared leaderboard rows, 30s TTL, tag `season-rankings-{seasonId}`
 * - `getPlayerOverallRank` / `getPlayerDistrictRank` — lookup within that cached snapshot, 45s TTL, tag `player-rank-{playerId}`
 * - Invalidation: `revalidatePlayerGameplayCache` clears both tags after mutations; header rank may lag up to 45s
 */
async function lookupPlayerRankInFilter(
  playerId: string,
  seasonId: string,
  filter: RankingsFilter,
): Promise<number> {
  const rows = await getCachedSeasonRankings(seasonId, filter);
  return rows.find((row) => row.id === playerId)?.rank ?? 0;
}

/** Derive overall + district rank from one overall leaderboard pass (avoids double cold scan). */
async function lookupPlayerRanksFromOverall(
  playerId: string,
  seasonId: string,
  districtSlug: string,
): Promise<{ overallRank: number; districtRank: number }> {
  const rows = await getCachedSeasonRankings(seasonId, 'overall');
  const overallRank = rows.find((row) => row.id === playerId)?.rank ?? 0;

  let districtRank = 0;
  let districtIndex = 0;
  for (const row of rows) {
    if (row.citySlug !== districtSlug) continue;
    districtIndex++;
    if (row.id === playerId) {
      districtRank = districtIndex;
      break;
    }
  }

  return { overallRank, districtRank };
}

const getCachedPlayerOverallRank = cache((playerId: string, seasonId: string) =>
  unstable_cache(
    () => lookupPlayerRankInFilter(playerId, seasonId, 'overall'),
    ['player-overall-rank', playerId, seasonId],
    { revalidate: PLAYER_RANK_CACHE_SECONDS, tags: [playerRankCacheTag(playerId)] },
  )(),
);

const getCachedPlayerDistrictRank = cache((playerId: string, seasonId: string, districtSlug: string) => {
  const filter = districtSlugToRankingsFilter(districtSlug);
  if (!filter) {
    return Promise.resolve(0);
  }
  return unstable_cache(
    () => lookupPlayerRankInFilter(playerId, seasonId, filter),
    ['player-district-rank', playerId, seasonId, districtSlug],
    {
      revalidate: PLAYER_RANK_CACHE_SECONDS,
      tags: [playerRankCacheTag(playerId), seasonRankingsCacheTag(seasonId)],
    },
  )();
});

const getCachedPlayerRanksFromOverall = cache((playerId: string, seasonId: string, districtSlug: string) =>
  unstable_cache(
    () => lookupPlayerRanksFromOverall(playerId, seasonId, districtSlug),
    ['player-ranks-overall-pass', playerId, seasonId, districtSlug],
    {
      revalidate: PLAYER_RANK_CACHE_SECONDS,
      tags: [playerRankCacheTag(playerId), seasonRankingsCacheTag(seasonId)],
    },
  )(),
);

export const RankingsService = {
  getSeasonRankings(seasonId: string, filter: RankingsFilter = 'overall'): Promise<RankingRow[]> {
    return getCachedSeasonRankings(seasonId, filter);
  },

  /** Season-wide rank — available on Rankings → Overall. */
  getPlayerOverallRank(playerId: string, seasonId: string): Promise<number> {
    return getCachedPlayerOverallRank(playerId, seasonId);
  },

  /** Rank within the player's current district leaderboard. */
  getPlayerDistrictRank(
    playerId: string,
    seasonId: string,
    districtSlug: string,
  ): Promise<number> {
    return getCachedPlayerDistrictRank(playerId, seasonId, districtSlug);
  },

  /** Single overall-leaderboard pass — header rank lookups without a second season scan. */
  getPlayerRanksFromOverall(
    playerId: string,
    seasonId: string,
    districtSlug: string,
  ): Promise<{ overallRank: number; districtRank: number }> {
    return getCachedPlayerRanksFromOverall(playerId, seasonId, districtSlug);
  },

  /** @deprecated Prefer getPlayerOverallRank or getPlayerDistrictRank. */
  getPlayerRank(playerId: string, seasonId: string): Promise<number> {
    return getCachedPlayerOverallRank(playerId, seasonId);
  },
};

export { RANK_NET_WORTH_SELECT, compareRankings };
