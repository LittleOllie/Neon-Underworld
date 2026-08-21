import { prisma } from '@core/lib/db/prisma';
import { NetWorthService } from './net-worth.service';
import { RankingsService } from './rankings.service';
import { PlayerStatusService } from './player-status.service';
import { resolvePlayerAvatarId } from '@core/lib/game-engine/resolve-player-avatar';
import { identityViewFromPlayer } from '@core/lib/game-engine/player-identity-fields';
import type { PlayerIdentityView } from '@core/lib/game-engine/player-identity-fields';

export interface PublicProfile {
  id: string;
  alias: string;
  aliasNormalized: string;
  avatarId: string;
  identity: PlayerIdentityView;
  districtId: string;
  city: string;
  citySlug: string;
  netWorth: number;
  rank: number;
  seasonNumber: number;
  joinedAt: Date;
  lastSeen: Date | null;
  online: boolean;
  lifeStatus: string;
  travelling: boolean;
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

    const netWorth = await NetWorthService.calculateFromPlayerAsync(player);
    const rank = await RankingsService.getPlayerDistrictRank(
      player.id,
      player.seasonId,
      player.district.slug,
    );
    const lastSeen = PlayerStatusService.resolveLastSeen(
      player.user.lastLoginAt,
      player.statusExt?.lastSeenAt,
      player.updatedAt,
    );

    return {
      id: player.id,
      alias: player.alias,
      aliasNormalized: player.aliasNormalized,
      avatarId: resolvePlayerAvatarId(player.avatar),
      identity: identityViewFromPlayer(player),
      districtId: player.districtId,
      city: player.district.name,
      citySlug: player.district.slug,
      netWorth,
      rank,
      seasonNumber: player.season.number,
      joinedAt: player.createdAt,
      lastSeen,
      online: PlayerStatusService.isOnline(lastSeen),
      lifeStatus: player.lifeStatus,
      travelling: player.travelling,
      cartelId: player.cartelId,
      cartelName: player.cartel?.name ?? null,
      cartelTag: player.cartel?.tag ?? null,
    };
  },
};
