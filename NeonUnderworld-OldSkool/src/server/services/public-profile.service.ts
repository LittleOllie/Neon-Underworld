import { prisma } from '@core/lib/db/prisma';
import { NetWorthService } from './net-worth.service';
import { RankingsService } from './rankings.service';
import { PlayerStatusService } from './player-status.service';

export interface PublicProfile {
  alias: string;
  aliasNormalized: string;
  districtId: string;
  city: string;
  citySlug: string;
  netWorth: number;
  rank: number;
  seasonNumber: number;
  joinedAt: Date;
  lastSeen: Date | null;
  online: boolean;
  cartelId: string | null;
  cartelName: string | null;
  cartelTag: string | null;
}

export const PublicProfileService = {
  async getByAlias(aliasNormalized: string): Promise<PublicProfile | null> {
    const player = await prisma.player.findUnique({
      where: { aliasNormalized: aliasNormalized.toLowerCase() },
      include: {
        district: true,
        season: true,
        cartel: { select: { name: true, tag: true } },
        user: { select: { lastLoginAt: true } },
        statusExt: true,
      },
    });

    if (!player || player.isSystemPlayer) return null;

    const netWorth = NetWorthService.calculateFromPlayer(player);
    const rank = await RankingsService.getPlayerRank(player.id, player.seasonId);
    const lastSeen = PlayerStatusService.resolveLastSeen(
      player.user.lastLoginAt,
      player.statusExt?.lastSeenAt,
      player.updatedAt,
    );

    return {
      alias: player.alias,
      aliasNormalized: player.aliasNormalized,
      districtId: player.districtId,
      city: player.district.name,
      citySlug: player.district.slug,
      netWorth,
      rank,
      seasonNumber: player.season.number,
      joinedAt: player.createdAt,
      lastSeen,
      online: PlayerStatusService.isOnline(lastSeen),
      cartelId: player.cartelId,
      cartelName: player.cartel?.name ?? null,
      cartelTag: player.cartel?.tag ?? null,
    };
  },
};
