import { prisma } from '@core/lib/db/prisma';
import { NetWorthService } from './net-worth.service';
import { RankingsService } from './rankings.service';
import { PlayerStatusService } from './player-status.service';
import type { OnlinePlayer } from '@local/domain/player.model';

export const OnlineService = {
  isOnline: PlayerStatusService.isOnline,

  async getRecentPlayers(seasonId: string, limit = 8): Promise<OnlinePlayer[]> {
    const rankings = await RankingsService.getSeasonRankings(seasonId, 'overall');
    return rankings.slice(0, limit).map((p) => ({
      username: p.alias,
      city: p.city,
      rank: p.rank,
      lastSeen: p.lastSeen,
      online: p.online,
    }));
  },

  async getOnlineCount(seasonId: string): Promise<number> {
    const players = await prisma.player.findMany({
      where: { seasonId, isSystemPlayer: false },
      include: {
        user: { select: { lastLoginAt: true } },
        statusExt: true,
      },
    });

    return players.filter((p) => {
      const lastSeen = PlayerStatusService.resolveLastSeen(
        p.user.lastLoginAt,
        p.statusExt?.lastSeenAt,
        p.updatedAt,
      );
      return PlayerStatusService.isOnline(lastSeen);
    }).length;
  },
};
