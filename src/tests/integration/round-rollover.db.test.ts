import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { v4 as uuidv4 } from 'uuid';
import { hashPassword } from '@/lib/security/crypto';
import { STARTING_RESOURCES } from '@/config/game/balance';
import { isAdminSchemaReady, resetAdminSchemaReadinessCache } from '@/lib/db/admin-schema-readiness';
import { SeasonAdminService } from '@/server/services/season-admin.service';
import { ensureRoundParticipation } from '@/server/services/round-activation.service';
import { MarketService } from '@/server/services/market.service';
import { CartelService } from '@/server/services/cartel.service';
import { countAttacksOnTargetLast24h } from '@/server/services/combat.service';
import { buildPlayerIntelSnapshot } from '@/lib/game-engine/combat/build-intel-snapshot';
import { getPlayerSeasonStartsAt, isReportFromCurrentRound } from '@/server/services/round-rollover.service';
import {
  countGameplayEvents,
  getPlayerSeasonActivatedAt,
  listActivatedHumanPlayerIds,
  listPlayerSeasonArchives,
  setPlayerSeasonActivatedAt,
} from '@/lib/db/admin-analytics-db';

import { GAMEPLAY_ANALYTICS_EVENTS } from '@/config/game/analytics-events';

const prisma = new PrismaClient();
const runDbTests = process.env.CARTEL_DB_INTEGRATION !== '0';

async function createHuman(
  label: string,
  seasonId: string,
  districtId: string,
  avatar = 'avatar-01',
): Promise<{ playerId: string; userId: string; alias: string }> {
  const suffix = Math.random().toString(36).slice(2, 8);
  const alias = `${label}${suffix}`;
  const aliasNormalized = alias.toLowerCase();
  const user = await prisma.user.create({
    data: {
      email: `${aliasNormalized}-${Date.now()}-${Math.random().toString(36).slice(2)}@rollover.local`,
      passwordHash: await hashPassword('test-not-for-login'),
      role: 'PLAYER',
    },
  });
  const player = await prisma.player.create({
    data: {
      userId: user.id,
      alias,
      aliasNormalized,
      avatar,
      seasonId,
      districtId,
      lifeStatus: 'ACTIVE',
      cash: 50_000,
      thugs: 50,
      prostitutes: 20,
      glocks: 10,
      businesses: 1,
    },
  });
  await prisma.playerTurnState.create({
    data: {
      playerId: player.id,
      currentTurns: 200,
      lastRegeneratedAt: new Date(),
      turnCap: 5000,
      regenerationRate: 2 / (5 * 60 * 1000),
    },
  });
  await prisma.playerStatusExt.create({
    data: { playerId: player.id, unreadReports: 0 },
  });
  return { playerId: player.id, userId: user.id, alias };
}

async function createNpc(
  label: string,
  seasonId: string,
  districtId: string,
): Promise<string> {
  const suffix = Math.random().toString(36).slice(2, 8);
  const alias = `${label}${suffix}`;
  const aliasNormalized = alias.toLowerCase();
  const user = await prisma.user.create({
    data: {
      email: `playtest-npc+${aliasNormalized}-${Date.now()}@rollover.local`,
      passwordHash: await hashPassword('test-not-for-login'),
      role: 'PLAYER',
    },
  });
  const player = await prisma.player.create({
    data: {
      userId: user.id,
      alias,
      aliasNormalized,
      seasonId,
      districtId,
      lifeStatus: 'ACTIVE',
      thugs: 100,
      prostitutes: 50,
      glocks: 20,
    },
  });
  await prisma.playerTurnState.create({
    data: {
      playerId: player.id,
      currentTurns: 200,
      lastRegeneratedAt: new Date(),
      turnCap: 5000,
      regenerationRate: 2 / (5 * 60 * 1000),
    },
  });
  await prisma.npcProgressionState.create({
    data: {
      playerId: player.id,
      archetype: 'street',
      growthSeed: 1,
      ladderSlot: 0,
      lastProgressedDay: 3,
    },
  });
  return player.id;
}

describe.runIf(runDbTests)('round rollover isolation', () => {
  let adminUserId: string;
  let priorActiveSeasonIds: string[] = [];
  let districtId: string;
  let round1Id: string;
  let round2Id: string;
  let humanA: { playerId: string; userId: string; alias: string; avatar: string };
  let humanB: { playerId: string; userId: string; alias: string };
  let npcId: string;
  let round1IntelReportId: string;
  let round1ListingId: string;
  let round1CartelId: string;

  beforeAll(async () => {
    resetAdminSchemaReadinessCache();
    if (!(await isAdminSchemaReady())) {
      throw new Error('Admin schema not ready — apply admin migration locally to run rollover test');
    }

    priorActiveSeasonIds = (
      await prisma.season.findMany({ where: { status: 'ACTIVE' }, select: { id: true } })
    ).map((s) => s.id);
    if (priorActiveSeasonIds.length > 0) {
      await prisma.season.updateMany({ where: { status: 'ACTIVE' }, data: { status: 'ENDED' } });
    }

    const district = await prisma.district.findFirst({ where: { slug: 'neon-strip' } });
    if (!district) throw new Error('neon-strip district missing');
    districtId = district.id;

    const admin = await prisma.user.create({
      data: {
        email: `admin-rollover-${Date.now()}@rollover.local`,
        passwordHash: await hashPassword('test-not-for-login'),
        role: 'ADMIN',
      },
    });
    adminUserId = admin.id;

    const round1Number = (await prisma.season.findFirst({ orderBy: { number: 'desc' } }))?.number ?? 0;
    const round1 = await prisma.season.create({
      data: {
        number: round1Number + 1000,
        name: `Rollover Test Round ${round1Number + 1000}`,
        status: 'ACTIVE',
        startsAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
        endsAt: new Date(Date.now() + 4 * 24 * 60 * 60 * 1000),
      },
    });
    round1Id = round1.id;
    const suffix = Math.random().toString(36).slice(2, 8);

    humanA = {
      ...(await createHuman('RolloverAlpha', round1Id, districtId, 'avatar-07')),
      avatar: 'avatar-07',
    };
    humanB = await createHuman('RolloverBeta', round1Id, districtId);
    npcId = await createNpc('RolloverNpc', round1Id, districtId);

    await setPlayerSeasonActivatedAt(prisma, humanA.playerId, new Date());
    await setPlayerSeasonActivatedAt(prisma, humanB.playerId, new Date());

    const business = await prisma.business.create({
      data: {
        playerId: humanA.playerId,
        businessType: 'NIGHTCLUB',
        districtId,
        name: 'Round1 Laundry',
        purchasePrice: 5000,
        level: 1,
        assignedWorkers: 2,
      },
    });

    round1CartelId = (
      await CartelService.createCartel(humanA.playerId, `Round1 Cartel ${suffix}`, `R${suffix.slice(0, 3).toUpperCase()}`)
    ).id;
    await CartelService.requestToJoin(humanB.playerId, round1CartelId);

    const intel = buildPlayerIntelSnapshot(
      {
        id: humanB.playerId,
        alias: humanB.alias,
        districtName: 'Neon Strip',
        thugs: 50,
        glocks: 10,
        uzis: 0,
        aks: 0,
        cash: 10_000,
        hash: 0,
        shrooms: 0,
        coke: 0,
        heroin: 0,
        cartelId: round1CartelId,
        canonicalNetWorth: 100_000,
      },
      90,
    );
    const intelReport = await prisma.report.create({
      data: {
        playerId: humanA.playerId,
        category: 'SCOUT',
        title: 'Intel',
        summary: `Intel on ${humanB.alias}`,
        body: 'Round 1 intel',
        metadata: { type: 'PLAYER_INTEL', intel },
        read: false,
      },
    });
    round1IntelReportId = intelReport.id;

    await prisma.playerStatusExt.update({
      where: { playerId: humanA.playerId },
      data: { unreadReports: 3 },
    });

    await prisma.combatEncounter.create({
      data: {
        attackerId: humanA.playerId,
        defenderId: humanB.playerId,
        scoutReportId: round1IntelReportId,
        attackType: 'HOME_INVASION',
        outcome: 'SUCCESS',
        attackingThugs: 10,
        attackerLosses: 1,
        defenderLosses: 2,
        attackerReturned: 9,
        ridesUsed: 0,
        turnsSpent: 5,
        attackerForceSnapshot: {},
        defenderForceSnapshot: {},
        idempotencyKey: uuidv4(),
      },
    });

    const listing = await MarketService.createListing(
      humanA.playerId,
      'glock',
      5,
      1000,
      60,
      uuidv4(),
    );
    round1ListingId = listing.listingId;

    await prisma.$executeRaw`
      INSERT INTO "GameplayEvent" ("id", "seasonId", "playerId", "eventType", "metadata", "createdAt")
      VALUES (${uuidv4()}, ${round1Id}, ${humanA.playerId}, ${GAMEPLAY_ANALYTICS_EVENTS.SCOUT_COMPLETED}, '{"test":true}'::jsonb, NOW())
    `;

    void business;
  });

  afterAll(async () => {
    if (round2Id) {
      await prisma.season.updateMany({ where: { id: round2Id }, data: { status: 'ENDED' } });
    }
    for (const seasonId of priorActiveSeasonIds) {
      await prisma.season.update({ where: { id: seasonId }, data: { status: 'ACTIVE' } });
    }
    await prisma.$disconnect();
  });

  it('ends round 1 and starts round 2 with configurable duration', async () => {
    const round1 = await prisma.season.findUniqueOrThrow({ where: { id: round1Id } });
    await SeasonAdminService.endRound(adminUserId, round1Id, `END ROUND ${round1.number}`);

    const ended = await prisma.season.findUniqueOrThrow({ where: { id: round1Id } });
    expect(ended.status).toBe('ENDED');

    const archives = await listPlayerSeasonArchives(humanA.playerId);
    expect(archives.some((a) => a.seasonId === round1Id)).toBe(true);

    const started = await SeasonAdminService.startNextRound(
      adminUserId,
      `START ROUND ${round1.number + 1}`,
      7,
    );
    round2Id = started.seasonId;

    const round2 = await prisma.season.findUniqueOrThrow({ where: { id: round2Id } });
    expect(round2.status).toBe('ACTIVE');
    expect(round2.number).toBe(round1.number + 1);
    expect(round2.endsAt.getTime() - round2.startsAt.getTime()).toBe(7 * 24 * 60 * 60 * 1000);
  });

  it('keeps unactivated humans out of rankings and PvP until login activation', async () => {
    const activatedBefore = await listActivatedHumanPlayerIds(round2Id);
    expect(activatedBefore).not.toContain(humanA.playerId);
    expect(activatedBefore).not.toContain(humanB.playerId);

    const playerA = await prisma.player.findUniqueOrThrow({ where: { id: humanA.playerId } });
    expect(playerA.seasonId).toBe(round2Id);
    expect(playerA.cash).toBe(STARTING_RESOURCES.cash);
    expect(playerA.avatar).toBe(humanA.avatar);
    expect(playerA.alias).toBe(humanA.alias);
    expect(await getPlayerSeasonActivatedAt(humanA.playerId)).toBeNull();

    const businesses = await prisma.business.findMany({ where: { playerId: humanA.playerId } });
    expect(businesses).toHaveLength(0);

    const cartel = await prisma.cartel.findUnique({ where: { id: round1CartelId } });
    expect(cartel).toBeNull();
    expect(playerA.cartelId).toBeNull();

    const listing = await prisma.marketListing.findUnique({ where: { id: round1ListingId } });
    expect(listing?.status).toBe('CANCELLED');

    const browse = await MarketService.getBrowseListings('all', { skipSettlement: true });
    expect(browse.some((l) => l.id === round1ListingId)).toBe(false);

    const oldIntel = await prisma.report.findUnique({ where: { id: round1IntelReportId } });
    const seasonStartsAt = await getPlayerSeasonStartsAt(humanA.playerId);
    expect(oldIntel).not.toBeNull();
    expect(seasonStartsAt).not.toBeNull();
    expect(isReportFromCurrentRound(oldIntel!.createdAt, seasonStartsAt!)).toBe(false);

    const capCount = await countAttacksOnTargetLast24h(
      humanA.playerId,
      humanB.playerId,
      (await prisma.season.findUniqueOrThrow({ where: { id: round2Id } })).startsAt,
    );
    expect(capCount).toBe(0);

    const status = await prisma.playerStatusExt.findUnique({ where: { playerId: humanA.playerId } });
    expect(status?.unreadReports).toBe(0);

    const round1Events = await countGameplayEvents(
      round1Id,
      GAMEPLAY_ANALYTICS_EVENTS.SCOUT_COMPLETED,
      humanA.playerId,
    );
    expect(round1Events).toBeGreaterThan(0);
  });

  it('activates human A exactly once with canonical resources', async () => {
    const first = await ensureRoundParticipation(humanA.playerId);
    expect(first).toEqual({ activated: true, firstActivation: true });

    const afterFirst = await prisma.player.findUniqueOrThrow({ where: { id: humanA.playerId } });
    expect(afterFirst.cash).toBe(STARTING_RESOURCES.cash);
    expect(await getPlayerSeasonActivatedAt(humanA.playerId)).not.toBeNull();

    const second = await ensureRoundParticipation(humanA.playerId);
    expect(second).toEqual({ activated: false, reason: 'already_active' });

    const afterSecond = await prisma.player.findUniqueOrThrow({ where: { id: humanA.playerId } });
    expect(afterSecond.cash).toBe(STARTING_RESOURCES.cash);

    const activatedAfterA = await listActivatedHumanPlayerIds(round2Id);
    expect(activatedAfterA).toContain(humanA.playerId);
    expect(activatedAfterA).not.toContain(humanB.playerId);
  });

  it('resets playtest NPC ladder to day 1 on new round', async () => {
    const npc = await prisma.player.findUniqueOrThrow({ where: { id: npcId } });
    expect(npc.seasonId).toBe(round2Id);

    const ladder = await prisma.npcProgressionState.findUnique({ where: { playerId: npcId } });
    expect(ladder?.lastProgressedDay).toBe(1);
  });
});
