import { prisma } from '@/lib/db/prisma';
import {
  countActivatedHumans,
  countGameplayEvents,
  countNewActivationsToday,
  getPlayerSeasonActivatedAt,
  groupGameplayEventsByType,
  listPlayerDailySnapshots,
  listPlayerSeasonArchives,
  listRecentGameplayEvents,
  listSeasonDailySnapshots,
} from '@/lib/db/admin-analytics-db';
import { activatedHumanPlayerWhere, humanPlayerWhere, isHumanPlayer } from '@/lib/game-engine/human-player';
import { formatSeasonStatus } from '@/lib/game/season-display';
import { GAMEPLAY_ANALYTICS_EVENTS } from '@/config/game/analytics-events';
import { calculateCanonicalNetWorthFromPlayer } from '@/lib/game-engine/canonical-net-worth';
import { aggregateBusinessNwContext } from '@/server/services/business.service';
import { isProgressionNpcAccount } from '@/lib/game-engine/npc-progression/identification';
import { getSeasonRoundDay } from '@/lib/game-engine/npc-progression/round-age';
import { resolveLastSeen, isPlayerOnline } from '@/lib/game-engine/player-presence';

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? Math.round((sorted[mid - 1]! + sorted[mid]!) / 2) : sorted[mid]!;
}

function eventMapFromRows(rows: Array<{ eventType: string; count: number }>) {
  return Object.fromEntries(rows.map((e) => [e.eventType, e.count]));
}

export const AdminDashboardService = {
  async getOverview() {
    const season = await prisma.season.findFirst({
      where: { status: 'ACTIVE' },
      orderBy: { number: 'desc' },
    });

    if (!season) {
      return { season: null, schemaReady: false };
    }

    const now = new Date();
    const dayStart = new Date(now);
    dayStart.setHours(0, 0, 0, 0);
    const last24h = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const last7d = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    const seasonDisplay = formatSeasonStatus(season.number, season.startsAt, season.endsAt, now);

    const [
      registeredHumans,
      activatedHumansRaw,
      humans,
      progressionNpcs,
      eventCountsToday,
      adminLogs,
      newActivationsTodayRaw,
    ] = await Promise.all([
      prisma.player.count({ where: humanPlayerWhere(season.id) }),
      countActivatedHumans(season.id),
      prisma.player.findMany({
        where: humanPlayerWhere(season.id),
        include: {
          user: { select: { lastLoginAt: true, email: true } },
          statusExt: true,
          turnState: true,
        },
      }),
      prisma.player.findMany({
        where: {
          seasonId: season.id,
          isSystemPlayer: false,
          OR: [
            { user: { email: { startsWith: 'playtest-npc+' } } },
            { user: { email: { startsWith: 'dev-pvp+' } } },
          ],
        },
        include: { user: { select: { email: true } }, npcProgression: true },
      }),
      groupGameplayEventsByType(season.id, { since: dayStart }),
      prisma.adminAuditLog.findMany({ orderBy: { createdAt: 'desc' }, take: 10 }),
      countNewActivationsToday(season.id, dayStart),
    ]);

    const activatedHumans = activatedHumansRaw ?? registeredHumans;
    const newActivationsToday = newActivationsTodayRaw ?? 0;

    const netWorths: number[] = [];
    let totalBusinesses = 0;
    let activeToday = 0;
    let active24h = 0;
    let active7d = 0;
    let onlineNow = 0;

    for (const h of humans) {
      const businesses = await prisma.business.findMany({ where: { playerId: h.id } });
      const bizCtx = aggregateBusinessNwContext(businesses);
      netWorths.push(
        calculateCanonicalNetWorthFromPlayer(h, {
          streetWorkers: h.prostitutes,
          ...bizCtx,
        }),
      );
      totalBusinesses += h.businesses;

      const lastSeen = resolveLastSeen(
        h.user.lastLoginAt,
        h.statusExt?.lastSeenAt ?? null,
        h.updatedAt,
      );
      if (lastSeen) {
        if (lastSeen >= dayStart) activeToday += 1;
        if (lastSeen >= last24h) active24h += 1;
        if (lastSeen >= last7d) active7d += 1;
        if (isPlayerOnline(lastSeen)) onlineNow += 1;
      }
    }

    const eventMap = eventMapFromRows(eventCountsToday);

    const progressionManaged = progressionNpcs.filter((n) =>
      isProgressionNpcAccount({ isSystemPlayer: n.isSystemPlayer, email: n.user.email }),
    );

    const roundDay = getSeasonRoundDay(season.startsAt, season.endsAt, now);
    const staleNpcs = progressionManaged.filter(
      (n) => (n.npcProgression?.lastProgressedDay ?? 0) < roundDay - 1,
    ).length;

    return {
      season: {
        id: season.id,
        name: season.name,
        status: season.status,
        startsAt: season.startsAt,
        endsAt: season.endsAt,
        ...seasonDisplay,
        number: season.number,
      },
      schemaReady: activatedHumansRaw !== null,
      humans: {
        registered: registeredHumans,
        activated: activatedHumans,
        activeToday,
        active24h,
        active7d,
        onlineNow,
        newActivationsToday,
      },
      gameHealth: {
        totalHumanNw: netWorths.reduce((s, v) => s + v, 0),
        medianHumanNw: median(netWorths),
        highestHumanNw: netWorths.length ? Math.max(...netWorths) : 0,
        medianWorkers: median(humans.map((h) => h.prostitutes)),
        medianThugs: median(humans.map((h) => h.thugs)),
        totalBusinesses,
        attacksToday: eventMap[GAMEPLAY_ANALYTICS_EVENTS.ATTACK_COMPLETED] ?? 0,
        scoutsToday: eventMap[GAMEPLAY_ANALYTICS_EVENTS.SCOUT_COMPLETED] ?? 0,
        produceToday: eventMap[GAMEPLAY_ANALYTICS_EVENTS.PRODUCE_COMPLETED] ?? 0,
        shopPurchasesToday: eventMap[GAMEPLAY_ANALYTICS_EVENTS.SHOP_PURCHASED] ?? 0,
        marketToday:
          (eventMap[GAMEPLAY_ANALYTICS_EVENTS.MARKET_LISTED] ?? 0) +
          (eventMap[GAMEPLAY_ANALYTICS_EVENTS.MARKET_PURCHASED] ?? 0),
      },
      npcHealth: {
        progressionManagedCount: progressionManaged.length,
        currentProgressionDay: roundDay,
        staleNpcCount: staleNpcs,
        districtSpread: [...new Set(progressionManaged.map((n) => n.districtId))].length,
      },
      recentAdminLogs: adminLogs,
    };
  },

  async listPlayers(input: {
    seasonId: string;
    search?: string;
    districtSlug?: string;
    activatedOnly?: boolean;
    sort?: 'nw' | 'activity' | 'alias';
    page?: number;
    pageSize?: number;
  }) {
    const page = input.page ?? 1;
    const pageSize = Math.min(input.pageSize ?? 25, 100);
    const skip = (page - 1) * pageSize;

    const where = {
      ...(input.activatedOnly
        ? activatedHumanPlayerWhere(input.seasonId)
        : humanPlayerWhere(input.seasonId)),
      ...(input.search
        ? { aliasNormalized: { contains: input.search.trim().toLowerCase() } }
        : {}),
      ...(input.districtSlug ? { district: { slug: input.districtSlug } } : {}),
    };

    const [total, players] = await Promise.all([
      prisma.player.count({ where }),
      prisma.player.findMany({
        where,
        include: {
          district: true,
          user: { select: { lastLoginAt: true, email: true } },
          statusExt: true,
          turnState: true,
        },
        orderBy: input.sort === 'alias' ? { alias: 'asc' } : { updatedAt: 'desc' },
        skip,
        take: pageSize,
      }),
    ]);

    const rows = await Promise.all(
      players.map(async (p) => {
        const businesses = await prisma.business.findMany({ where: { playerId: p.id } });
        const bizCtx = aggregateBusinessNwContext(businesses);
        const netWorth = calculateCanonicalNetWorthFromPlayer(p, {
          streetWorkers: p.prostitutes,
          ...bizCtx,
        });
        const lastSeen = resolveLastSeen(
          p.user.lastLoginAt,
          p.statusExt?.lastSeenAt ?? null,
          p.updatedAt,
        );
        const [scoutCount, produceCount, attackCount, shopCount, seasonActivatedAt] =
          await Promise.all([
            countGameplayEvents(input.seasonId, GAMEPLAY_ANALYTICS_EVENTS.SCOUT_COMPLETED, p.id),
            countGameplayEvents(input.seasonId, GAMEPLAY_ANALYTICS_EVENTS.PRODUCE_COMPLETED, p.id),
            countGameplayEvents(input.seasonId, GAMEPLAY_ANALYTICS_EVENTS.ATTACK_COMPLETED, p.id),
            countGameplayEvents(input.seasonId, GAMEPLAY_ANALYTICS_EVENTS.SHOP_PURCHASED, p.id),
            getPlayerSeasonActivatedAt(p.id),
          ]);

        return {
          id: p.id,
          alias: p.alias,
          avatar: p.avatar,
          district: p.district.name,
          districtSlug: p.district.slug,
          netWorth,
          cash: p.cash,
          bankCash: p.bankCash,
          turns: p.turnState?.currentTurns ?? 0,
          workers: p.prostitutes,
          thugs: p.thugs,
          businesses: p.businesses,
          lifeStatus: p.lifeStatus,
          lastSeen,
          online: lastSeen ? isPlayerOnline(lastSeen) : false,
          seasonActivatedAt,
          isHuman: isHumanPlayer({ isSystemPlayer: p.isSystemPlayer, email: p.user.email }),
          scoutCount,
          produceCount,
          attackCount,
          shopCount,
        };
      }),
    );

    if (input.sort === 'nw') {
      rows.sort((a, b) => b.netWorth - a.netWorth);
    } else if (input.sort === 'activity') {
      rows.sort((a, b) => (b.lastSeen?.getTime() ?? 0) - (a.lastSeen?.getTime() ?? 0));
    }

    return { total, page, pageSize, rows };
  },

  async getPlayerDetail(playerId: string) {
    const player = await prisma.player.findUnique({
      where: { id: playerId },
      include: {
        district: true,
        user: { select: { id: true, email: true, createdAt: true, lastLoginAt: true } },
        turnState: true,
        statusExt: true,
        season: true,
      },
    });
    if (!player) return null;

    const businesses = await prisma.business.findMany({ where: { playerId } });
    const bizCtx = aggregateBusinessNwContext(businesses);
    const netWorth = calculateCanonicalNetWorthFromPlayer(player, {
      streetWorkers: player.prostitutes,
      ...bizCtx,
    });

    const [events, snapshots, adminLogs, eventCounts, roundHistory, activationDate] =
      await Promise.all([
        listRecentGameplayEvents(playerId),
        listPlayerDailySnapshots(playerId),
        prisma.adminAuditLog.findMany({
          where: {
            OR: [{ targetId: playerId }, { metadata: { path: ['playerId'], equals: playerId } }],
          },
          orderBy: { createdAt: 'desc' },
          take: 20,
        }),
        groupGameplayEventsByType(player.seasonId, { playerId }),
        listPlayerSeasonArchives(playerId),
        getPlayerSeasonActivatedAt(playerId),
      ]);

    const startingSnapshot = snapshots[0] ?? null;
    const latestSnapshot = snapshots[snapshots.length - 1] ?? null;

    return {
      player: {
        ...player,
        netWorth,
        isHuman: isHumanPlayer({ isSystemPlayer: player.isSystemPlayer, email: player.user.email }),
      },
      eventCounts: eventMapFromRows(eventCounts),
      recentEvents: events,
      snapshots,
      progression: {
        activationDate,
        startingSnapshot,
        latestSnapshot,
        nwGrowth:
          startingSnapshot && latestSnapshot
            ? latestSnapshot.netWorth - startingSnapshot.netWorth
            : null,
        workerGrowth:
          startingSnapshot && latestSnapshot
            ? latestSnapshot.workers - startingSnapshot.workers
            : null,
        thugGrowth:
          startingSnapshot && latestSnapshot
            ? latestSnapshot.thugs - startingSnapshot.thugs
            : null,
      },
      adminLogs,
      roundHistory,
    };
  },

  async getSeasonAnalytics(seasonId: string) {
    const season = await prisma.season.findUnique({ where: { id: seasonId } });
    if (!season) return null;

    const [activatedRaw, eventsByType, snapshots, sessionStarts] = await Promise.all([
      countActivatedHumans(seasonId),
      groupGameplayEventsByType(seasonId),
      listSeasonDailySnapshots(seasonId),
      countGameplayEvents(seasonId, GAMEPLAY_ANALYTICS_EVENTS.PLAYER_SESSION_STARTED),
    ]);

    const activatedPlayers =
      activatedRaw ??
      (await prisma.player.count({ where: humanPlayerWhere(seasonId) }));

    const medianNwByDay = new Map<number, number[]>();
    for (const s of snapshots) {
      const list = medianNwByDay.get(s.roundDay) ?? [];
      list.push(s.netWorth);
      medianNwByDay.set(s.roundDay, list);
    }

    return {
      season,
      activatedPlayers,
      eventsByType: eventMapFromRows(eventsByType),
      medianNwByDay: [...medianNwByDay.entries()].map(([roundDay, values]) => ({
        roundDay,
        medianNw: median(values),
        sampleSize: values.length,
      })),
      sessionStarts,
    };
  },
};
