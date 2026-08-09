import { prisma } from '@/lib/db/prisma';
import { settleTurnRegeneration, formatTimeUntilNextTurn } from '@/lib/game-engine/turns';
import { calculateNetWorth } from '@/lib/game-engine/net-worth';
import { playerToResources } from '@/lib/game-engine/state';
import {
  calculateProstituteHappiness,
  calculateThugHappiness,
} from '@/lib/game-engine/happiness';
import { formatSeasonStatus } from '@/lib/game/season-display';

export async function getPlayerState(playerId: string) {
  const player = await prisma.player.findUnique({
    where: { id: playerId },
    include: {
      turnState: true,
      district: true,
      season: true,
      user: { select: { lastLoginAt: true, email: true } },
    },
  });

  if (!player || !player.turnState) return null;

  const settled = settleTurnRegeneration({
    currentTurns: player.turnState.currentTurns,
    lastRegeneratedAt: player.turnState.lastRegeneratedAt,
    turnCap: player.turnState.turnCap,
    regenerationRatePerMs: player.turnState.regenerationRate,
  });

  const netWorth = calculateNetWorth(playerToResources(player));
  const rank = await getPlayerRank(playerId, player.seasonId);

  const prostituteHappiness = calculateProstituteHappiness({
    prostitutes: player.prostitutes,
    thugs: player.thugs,
    hash: player.hash,
    condoms: player.condoms,
    prostitutePayoutPercent: player.prostitutePayoutPercent,
  });

  const thugHappiness = calculateThugHappiness({
    thugs: player.thugs,
    glocks: player.glocks,
    uzis: player.uzis,
    aks: player.aks,
    beer: player.beer,
  });

  const seasonEnd = player.season.endsAt;
  const seasonStart = player.season.startsAt;
  const seasonDisplay = formatSeasonStatus(player.season.number, seasonStart, seasonEnd);

  const previousSnapshot = await prisma.rankSnapshot.findFirst({
    where: { playerId },
    orderBy: { createdAt: 'desc' },
    skip: 1,
  });
  const previousNetWorth = previousSnapshot?.netWorth ?? netWorth;
  const netWorthMovement = netWorth - previousNetWorth;

  const previousRankSnapshot = await prisma.rankSnapshot.findMany({
    where: { playerId, seasonId: player.seasonId },
    orderBy: { createdAt: 'desc' },
    take: 2,
  });
  let rankMovement = 0;
  if (previousRankSnapshot.length >= 2) {
    const prevNw = previousRankSnapshot[1]!.netWorth;
    const allPlayers = await prisma.player.findMany({ where: { seasonId: player.seasonId } });
    const prevRanked = allPlayers
      .map((p) => ({ id: p.id, nw: calculateNetWorth(playerToResources(p)) }))
      .sort((a, b) => b.nw - a.nw);
    const prevRankIdx = prevRanked.findIndex((p) => p.id === playerId);
    const oldRank = prevRankIdx >= 0 ? prevRankIdx + 1 : rank;
    rankMovement = oldRank - rank;
  }

  return {
    id: player.id,
    alias: player.alias,
    district: player.district,
    season: player.season,
    seasonDisplay,
    daysRemaining: seasonDisplay.daysRemaining,
    cash: player.cash,
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
    prostitutePayoutPercent: player.prostitutePayoutPercent,
    turns: settled.currentTurns,
    turnCap: settled.turnCap,
    isAtCap: settled.isAtCap,
    msUntilNextTurn: settled.msUntilNextTurn,
    timeUntilNextTurn: formatTimeUntilNextTurn(settled.msUntilNextTurn),
    netWorth,
    rank,
    rankMovement,
    netWorthMovement,
    prostituteHappiness,
    thugHappiness,
    lastLoginAt: player.user.lastLoginAt,
  };
}

export async function getPlayerRank(playerId: string, seasonId: string): Promise<number> {
  const player = await prisma.player.findUnique({ where: { id: playerId } });
  if (!player) return 0;

  const allPlayers = await prisma.player.findMany({ where: { seasonId } });
  const ranked = allPlayers
    .map((p) => ({ id: p.id, netWorth: calculateNetWorth(playerToResources(p)) }))
    .sort((a, b) => b.netWorth - a.netWorth);

  const idx = ranked.findIndex((p) => p.id === playerId);
  return idx >= 0 ? idx + 1 : ranked.length + 1;
}

export async function getRankings(seasonId: string, page = 1, pageSize = 25) {
  const players = await prisma.player.findMany({
    where: { seasonId },
    include: { district: true },
    orderBy: { updatedAt: 'desc' },
  });

  const withNetWorth = players.map((p) => ({
    id: p.id,
    alias: p.alias,
    aliasNormalized: p.aliasNormalized,
    district: p.district.name,
    districtSlug: p.district.slug,
    netWorth: calculateNetWorth(playerToResources(p)),
    isSystemPlayer: p.isSystemPlayer,
    createdAt: p.createdAt,
    updatedAt: p.updatedAt,
  }));

  withNetWorth.sort((a, b) => b.netWorth - a.netWorth);

  const snapshots = await prisma.rankSnapshot.findMany({
    where: { seasonId },
    orderBy: { createdAt: 'desc' },
    distinct: ['playerId'],
  });

  const snapshotMap = new Map(snapshots.map((s) => [s.playerId, s.netWorth]));

  const enriched = withNetWorth.map((p, i) => ({
    ...p,
    rank: i + 1,
    netWorthMovement: snapshotMap.has(p.id) ? p.netWorth - (snapshotMap.get(p.id) ?? p.netWorth) : 0,
  }));

  const total = enriched.length;
  const start = (page - 1) * pageSize;
  const items = enriched.slice(start, start + pageSize);

  return { items, total, page, pageSize };
}

export async function getPublicProfile(aliasNormalized: string) {
  const player = await prisma.player.findUnique({
    where: { aliasNormalized: aliasNormalized.toLowerCase() },
    include: { district: true, season: true, user: { select: { createdAt: true, lastLoginAt: true } } },
  });

  if (!player) return null;

  const netWorth = calculateNetWorth(playerToResources(player));
  const rank = await getPlayerRank(player.id, player.seasonId);

  const recentSnapshots = await prisma.rankSnapshot.findMany({
    where: { playerId: player.id },
    orderBy: { createdAt: 'desc' },
    take: 5,
  });

  return {
    alias: player.alias,
    district: player.district.name,
    netWorth,
    rank,
    seasonNumber: player.season.number,
    joinedAt: player.createdAt,
    lastSeen: player.user.lastLoginAt,
    netWorthTrend: recentSnapshots.map((s) => ({ netWorth: s.netWorth, at: s.createdAt })),
  };
}

export async function getCityIntelligence(seasonId: string) {
  const { items } = await getRankings(seasonId, 1, 1);
  const topPlayer = items[0] ?? null;

  const recentSnapshots = await prisma.rankSnapshot.findMany({
    where: { seasonId },
    orderBy: { createdAt: 'desc' },
    take: 50,
  });

  let largestMovement = { alias: '', movement: 0 };
  if (recentSnapshots.length >= 2) {
    const byPlayer = new Map<string, number[]>();
    for (const s of recentSnapshots) {
      const arr = byPlayer.get(s.playerId) ?? [];
      arr.push(s.netWorth);
      byPlayer.set(s.playerId, arr);
    }
    for (const [playerId, values] of byPlayer) {
      if (values.length >= 2) {
        const movement = values[0]! - values[values.length - 1]!;
        if (Math.abs(movement) > Math.abs(largestMovement.movement)) {
          const p = await prisma.player.findUnique({ where: { id: playerId } });
          if (p) largestMovement = { alias: p.alias, movement };
        }
      }
    }
  }

  const districtCounts = await prisma.player.groupBy({
    by: ['districtId'],
    where: { seasonId },
    _count: true,
  });

  const districts = await prisma.district.findMany();
  const districtMap = new Map(districts.map((d) => [d.id, d.name]));

  let topDistrict = { name: '', count: 0 };
  for (const dc of districtCounts) {
    if (dc._count > topDistrict.count) {
      topDistrict = { name: districtMap.get(dc.districtId) ?? 'Unknown', count: dc._count };
    }
  }

  const latestEvent = await prisma.economicAuditLog.findFirst({
    where: { eventType: { in: ['SCOUT', 'PLAYER_REGISTERED'] } },
    orderBy: { createdAt: 'desc' },
  });

  return {
    topPlayer,
    largestMovement,
    topDistrict,
    latestEvent: latestEvent
      ? { type: latestEvent.eventType, at: latestEvent.createdAt }
      : null,
  };
}

export async function getRecentActivity(playerId: string, limit = 10) {
  return prisma.economicAuditLog.findMany({
    where: { playerId },
    orderBy: { createdAt: 'desc' },
    take: limit,
  });
}

export async function getRecentScouts(playerId: string, limit = 5) {
  return prisma.scoutResult.findMany({
    where: { playerId },
    include: { district: true },
    orderBy: { createdAt: 'desc' },
    take: limit,
  });
}

export async function getDistricts() {
  return prisma.district.findMany({ where: { active: true }, orderBy: { name: 'asc' } });
}

export async function getActiveSeason() {
  return prisma.season.findFirst({ where: { status: 'ACTIVE' } });
}

export type PlayerState = NonNullable<Awaited<ReturnType<typeof getPlayerState>>>;
