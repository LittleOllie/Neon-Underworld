import { cache } from 'react';
import { prisma } from '@core/lib/db/prisma';
import { formatSeasonStatus } from '@core/lib/game/season-display';
import {
  calculateProstituteHappiness,
  calculateThugHappiness,
} from '@core/lib/game-engine/happiness';
import { formatTimeUntilNextTurn } from '@core/lib/game-engine/turns';
import { TurnService } from './turn.service';
import { NetWorthService } from './net-worth.service';
import { ActivityService } from './activity.service';
import { RankingsService } from './rankings.service';
import { ReportService } from './report.service';
import { PlayerStatusService } from './player-status.service';
import type { ReportPreview } from '@local/domain/player.model';
import { ACTIVITY_TYPES } from '@local/config/activity-types';

export interface CanonicalPlayerContext {
  id: string;
  alias: string;
  aliasNormalized: string;
  seasonId: string;
  season: { number: number; startsAt: Date; endsAt: Date };
  seasonDisplay: ReturnType<typeof formatSeasonStatus>;
  daysRemaining: number;
  district: { id: string; name: string; slug: string; description: string };
  cash: number;
  bankCash: number;
  prostitutes: number;
  thugs: number;
  rides: number;
  glocks: number;
  uzis: number;
  aks: number;
  beer: number;
  condoms: number;
  hash: number;
  shrooms: number;
  coke: number;
  heroin: number;
  businesses: number;
  prostitutePayoutPercent: number;
  turns: number;
  turnCap: number;
  isAtCap: boolean;
  msUntilNextTurn: number;
  /** @deferred Partial regen progress not reflected — not shown in UI during v1. */
  timeUntilNextTurn: string;
  netWorth: number;
  /** Primary player-facing rank — current district leaderboard position. */
  rank: number;
  /** Season-wide rank — available on Rankings → Overall. */
  overallRank: number;
  prostituteHappiness: ReturnType<typeof calculateProstituteHappiness>;
  thugHappiness: ReturnType<typeof calculateThugHappiness>;
  lastSeen: Date | null;
  online: boolean;
  cartelId: string | null;
  cartelName: string | null;
  cartelTag: string | null;
  avatar: string | null;
  wireEnabled: boolean;
  health: number;
  lifeStatus: string;
  travelling: boolean;
  travelDestination: string | null;
  travelArrival: Date | null;
  protectionStatus: string;
}

async function loadPlayerRecord(playerId: string) {
  return prisma.player.findUniqueOrThrow({
    where: { id: playerId },
    include: {
      district: true,
      season: true,
      turnState: true,
      cartel: { select: { name: true, tag: true } },
      user: { select: { lastLoginAt: true } },
      statusExt: true,
    },
  });
}

function buildCanonicalContext(
  player: Awaited<ReturnType<typeof loadPlayerRecord>>,
  districtRank: number,
  overallRank: number,
  netWorth: number,
): CanonicalPlayerContext {
  if (!player.turnState) {
    throw new Error('Player turn state missing');
  }

  const settled = TurnService.settle({
    currentTurns: player.turnState.currentTurns,
    lastRegeneratedAt: player.turnState.lastRegeneratedAt,
    turnCap: player.turnState.turnCap,
    regenerationRatePerMs: player.turnState.regenerationRate,
  });

  const seasonDisplay = formatSeasonStatus(
    player.season.number,
    player.season.startsAt,
    player.season.endsAt,
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
    seasonId: player.seasonId,
    season: player.season,
    seasonDisplay,
    daysRemaining: seasonDisplay.daysRemaining,
    district: {
      id: player.districtId,
      name: player.district.name,
      slug: player.district.slug,
      description: player.district.description,
    },
    cash: player.cash,
    bankCash: player.bankCash,
    prostitutes: player.prostitutes,
    thugs: player.thugs,
    rides: player.rides,
    glocks: player.glocks,
    uzis: player.uzis,
    aks: player.aks,
    beer: player.beer,
    condoms: player.condoms,
    hash: player.hash,
    shrooms: player.shrooms,
    coke: player.coke,
    heroin: player.heroin,
    businesses: player.businesses,
    prostitutePayoutPercent: player.prostitutePayoutPercent,
    turns: settled.currentTurns,
    turnCap: settled.turnCap,
    isAtCap: settled.isAtCap,
    msUntilNextTurn: settled.msUntilNextTurn,
    timeUntilNextTurn: formatTimeUntilNextTurn(settled.msUntilNextTurn),
    netWorth,
    rank: districtRank,
    overallRank,
    prostituteHappiness: calculateProstituteHappiness({
      prostitutes: player.prostitutes,
      thugs: player.thugs,
      hash: player.hash,
      condoms: player.condoms,
      prostitutePayoutPercent: player.prostitutePayoutPercent,
    }),
    thugHappiness: calculateThugHappiness({
      thugs: player.thugs,
      glocks: player.glocks,
      uzis: player.uzis,
      aks: player.aks,
      beer: player.beer,
    }),
    lastSeen,
    online: PlayerStatusService.isOnline(lastSeen),
    cartelId: player.cartelId,
    cartelName: player.cartel?.name ?? null,
    cartelTag: player.cartel?.tag ?? null,
    avatar: player.avatar,
    wireEnabled: player.wireEnabled,
    health: player.health,
    lifeStatus: player.lifeStatus,
    travelling: player.travelling,
    travelDestination: player.travelDestination,
    travelArrival: player.travelArrival,
    protectionStatus: player.protectionStatus,
  };
}

const getCanonicalContextCached = cache(async (playerId: string): Promise<CanonicalPlayerContext> => {
  const player = await loadPlayerRecord(playerId);
  const [ranks, netWorth] = await Promise.all([
    RankingsService.getPlayerRanksFromOverall(playerId, player.seasonId, player.district.slug),
    NetWorthService.calculateFromPlayerAsync(player),
  ]);
  return buildCanonicalContext(player, ranks.districtRank, ranks.overallRank, netWorth);
});

export const PlayerService = {
  getCanonicalContext(playerId: string): Promise<CanonicalPlayerContext> {
    return getCanonicalContextCached(playerId);
  },

  async getRecentReports(playerId: string, limit = 5): Promise<ReportPreview[]> {
    return ReportService.getRecent(playerId, limit);
  },

  async recordLogin(playerId: string, username: string): Promise<void> {
    await ActivityService.record(
      playerId,
      ACTIVITY_TYPES.LOGIN,
      `${username} logged in from Command.`,
    );
    await PlayerStatusService.touchLastSeen(playerId);
  },

  async recordLoginIfNeeded(playerId: string, username: string): Promise<void> {
    const recent = await prisma.activity.findFirst({
      where: {
        playerId,
        category: ACTIVITY_TYPES.LOGIN,
        createdAt: { gte: new Date(Date.now() - 30 * 60 * 1000) },
      },
    });
    if (recent) return;
    await this.recordLogin(playerId, username);
  },
};
