import { prisma } from '@core/lib/db/prisma';
import { NetWorthService, type PlayerNetWorthRecord } from './net-worth.service';
import { PlayerStatusService } from './player-status.service';

export type RankingsFilter = 'overall' | 'neon-strip' | 'docklands' | 'old-quarter';

export interface RankingRow {
  id: string;
  rank: number;
  alias: string;
  aliasNormalized: string;
  city: string;
  citySlug: string;
  cartelId: string | null;
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

function compareRankings(
  a: { netWorth: number; createdAt: Date; id: string },
  b: { netWorth: number; createdAt: Date; id: string },
): number {
  if (b.netWorth !== a.netWorth) return b.netWorth - a.netWorth;
  const created = a.createdAt.getTime() - b.createdAt.getTime();
  if (created !== 0) return created;
  return a.id.localeCompare(b.id);
}

export const RankingsService = {
  async getSeasonRankings(
    seasonId: string,
    filter: RankingsFilter = 'overall',
  ): Promise<RankingRow[]> {
    const districtSlug =
      filter === 'overall' ? undefined : DISTRICT_FILTERS[filter];

    const players = await prisma.player.findMany({
      where: {
        seasonId,
        isSystemPlayer: false,
        ...(districtSlug ? { district: { slug: districtSlug } } : {}),
      },
      include: {
        district: true,
        user: { select: { lastLoginAt: true } },
        statusExt: true,
      },
      orderBy: { createdAt: 'asc' },
    });

    const netWorthMap = NetWorthService.calculateForPlayers(
      players as PlayerNetWorthRecord[],
    );

    const enriched = players.map((p) => {
      const lastSeen = PlayerStatusService.resolveLastSeen(
        p.user.lastLoginAt,
        p.statusExt?.lastSeenAt,
        p.updatedAt,
      );
      return {
        id: p.id,
        alias: p.alias,
        aliasNormalized: p.aliasNormalized,
        city: p.district.name,
        citySlug: p.district.slug,
        cartelId: p.cartelId,
        netWorth: netWorthMap.get(p.id) ?? 0,
        lastSeen,
        online: PlayerStatusService.isOnline(lastSeen),
        createdAt: p.createdAt,
      };
    });

    enriched.sort(compareRankings);

    return enriched.map((row, i) => ({ ...row, rank: i + 1 }));
  },

  async getPlayerRank(playerId: string, seasonId: string): Promise<number> {
    const rows = await this.getSeasonRankings(seasonId, 'overall');
    const found = rows.find((r) => r.id === playerId);
    return found?.rank ?? 0;
  },
};
