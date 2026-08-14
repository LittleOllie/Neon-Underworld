import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { v4 as uuidv4 } from 'uuid';
import { hashPassword } from '@/lib/security/crypto';
import { resolveAttackEncounter } from '@/server/services/combat.service';
import { buildPlayerIntelSnapshot } from '@/lib/game-engine/combat/build-intel-snapshot';

const prisma = new PrismaClient();
const runDbTests = process.env.CARTEL_DB_INTEGRATION !== '0';

async function createCombatPlayer(
  alias: string,
  seasonId: string,
  districtId: string,
  overrides: Partial<{
    cash: number;
    thugs: number;
    rides: number;
    prostitutes: number;
    hash: number;
  }> = {},
): Promise<{ playerId: string; userId: string }> {
  const aliasNormalized = alias.toLowerCase();
  const user = await prisma.user.create({
    data: {
      email: `${aliasNormalized}-${Date.now()}@pvp-concurrency.local`,
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
      thugs: overrides.thugs ?? 200,
      rides: overrides.rides ?? 100,
      glocks: 50,
      uzis: 20,
      aks: 10,
      cash: overrides.cash ?? 500_000,
      prostitutes: overrides.prostitutes ?? 100,
      hash: overrides.hash ?? 1000,
    },
  });
  await prisma.playerTurnState.create({
    data: {
      playerId: player.id,
      currentTurns: 500,
      lastRegeneratedAt: new Date(),
      turnCap: 5000,
      regenerationRate: 2 / (5 * 60 * 1000),
    },
  });
  return { playerId: player.id, userId: user.id };
}

async function seedIntel(attackerId: string, defender: { id: string; alias: string; districtName: string }) {
  const intel = buildPlayerIntelSnapshot(
    {
      id: defender.id,
      alias: defender.alias,
      districtName: defender.districtName,
      thugs: 80,
      glocks: 20,
      uzis: 10,
      aks: 5,
      cash: 100_000,
      hash: 500,
      shrooms: 0,
      coke: 0,
      heroin: 0,
      cartelId: null,
      canonicalNetWorth: 500_000,
    },
    42,
  );
  const report = await prisma.report.create({
    data: {
      playerId: attackerId,
      category: 'SCOUT',
      title: `Intel: ${defender.alias}`,
      summary: 'Test intel',
      metadata: { type: 'PLAYER_INTEL', intel } as object,
    },
  });
  return report.id;
}

describe.skipIf(!runDbTests)('PvP same-target concurrency', () => {
  let seasonId = '';
  let districtId = '';
  let defenderId = '';
  let attackerA = '';
  let attackerB = '';
  let userA = '';
  let userB = '';
  let reportA = '';
  let reportB = '';

  beforeAll(async () => {
    const season = await prisma.season.findFirst({ where: { status: 'ACTIVE' } });
    if (!season) throw new Error('No active season');
    seasonId = season.id;
    const district = await prisma.district.findFirst();
    if (!district) throw new Error('No district');
    districtId = district.id;

    const defender = await createCombatPlayer(`DefPvp${Date.now()}`, seasonId, districtId, {
      cash: 200_000,
      hash: 800,
      prostitutes: 120,
    });
    defenderId = defender.playerId;

    const a = await createCombatPlayer(`AttA${Date.now()}`, seasonId, districtId);
    const b = await createCombatPlayer(`AttB${Date.now()}`, seasonId, districtId);
    attackerA = a.playerId;
    userA = a.userId;
    attackerB = b.playerId;
    userB = b.userId;

    const defenderRow = await prisma.player.findUniqueOrThrow({
      where: { id: defenderId },
      include: { district: true },
    });

    reportA = await seedIntel(attackerA, {
      id: defenderId,
      alias: defenderRow.alias,
      districtName: defenderRow.district.name,
    });
    reportB = await seedIntel(attackerB, {
      id: defenderId,
      alias: defenderRow.alias,
      districtName: defenderRow.district.name,
    });
  });

  afterAll(async () => {
    const ids = [defenderId, attackerA, attackerB];
    await prisma.combatEncounter.deleteMany({ where: { OR: [{ attackerId: { in: ids } }, { defenderId: { in: ids } }] } });
    await prisma.report.deleteMany({ where: { playerId: { in: ids } } });
    await prisma.playerTurnState.deleteMany({ where: { playerId: { in: ids } } });
    for (const id of ids) {
      await prisma.player.delete({ where: { id } }).catch(() => {});
    }
    await prisma.$disconnect();
  });

  it('two attackers on same defender conserve resources', async () => {
    const defenderBefore = await prisma.player.findUniqueOrThrow({ where: { id: defenderId } });
    const keyA = uuidv4();
    const keyB = uuidv4();

    const [resultA, resultB] = await Promise.all([
      resolveAttackEncounter(attackerA, userA, { kind: 'intel', scoutReportId: reportA }, 'HOME_INVASION', 50, keyA),
      resolveAttackEncounter(attackerB, userB, { kind: 'intel', scoutReportId: reportB }, 'RAID_DRUG_LABS', 50, keyB),
    ]);

    expect(resultA.idempotentReplay).toBe(false);
    expect(resultB.idempotentReplay).toBe(false);

    const defenderAfter = await prisma.player.findUniqueOrThrow({ where: { id: defenderId } });
    expect(defenderAfter.cash).toBeGreaterThanOrEqual(0);
    expect(defenderAfter.hash).toBeGreaterThanOrEqual(0);
    expect(defenderAfter.prostitutes).toBeGreaterThanOrEqual(0);
    expect(defenderAfter.thugs).toBeGreaterThanOrEqual(0);
    expect(defenderAfter.cash).toBeLessThanOrEqual(defenderBefore.cash);
    expect(defenderAfter.hash).toBeLessThanOrEqual(defenderBefore.hash);

    const turnsA = await prisma.playerTurnState.findUniqueOrThrow({ where: { playerId: attackerA } });
    const turnsB = await prisma.playerTurnState.findUniqueOrThrow({ where: { playerId: attackerB } });
    expect(turnsA.currentTurns).toBe(500 - resultA.turnsSpent);
    expect(turnsB.currentTurns).toBe(500 - resultB.turnsSpent);

    const encounters = await prisma.combatEncounter.count({
      where: { defenderId, attackerId: { in: [attackerA, attackerB] } },
    });
    expect(encounters).toBe(2);
  });
});

describe.skipIf(!runDbTests)('Attack idempotency', () => {
  let seasonId = '';
  let districtId = '';
  let defenderId = '';
  let attackerId = '';
  let userId = '';
  let reportId = '';

  beforeAll(async () => {
    const season = await prisma.season.findFirst({ where: { status: 'ACTIVE' } });
    if (!season) throw new Error('No active season');
    seasonId = season.id;
    const district = await prisma.district.findFirst();
    if (!district) throw new Error('No district');
    districtId = district.id;

    const defender = await createCombatPlayer(`DefIdem${Date.now()}`, seasonId, districtId);
    defenderId = defender.playerId;
    const attacker = await createCombatPlayer(`AttIdem${Date.now()}`, seasonId, districtId);
    attackerId = attacker.playerId;
    userId = attacker.userId;

    const defenderRow = await prisma.player.findUniqueOrThrow({
      where: { id: defenderId },
      include: { district: true },
    });
    reportId = await seedIntel(attackerId, {
      id: defenderId,
      alias: defenderRow.alias,
      districtName: defenderRow.district.name,
    });
  });

  afterAll(async () => {
    const ids = [defenderId, attackerId];
    await prisma.combatEncounter.deleteMany({ where: { OR: [{ attackerId: { in: ids } }, { defenderId: { in: ids } }] } });
    await prisma.report.deleteMany({ where: { playerId: { in: ids } } });
    await prisma.playerTurnState.deleteMany({ where: { playerId: { in: ids } } });
    for (const id of ids) {
      await prisma.player.delete({ where: { id } }).catch(() => {});
    }
    await prisma.$disconnect();
  });

  it('replays same idempotency key without double charge', async () => {
    const key = uuidv4();
    const turnsBefore = (await prisma.playerTurnState.findUniqueOrThrow({ where: { playerId: attackerId } }))
      .currentTurns;

    const first = await resolveAttackEncounter(
      attackerId,
      userId,
      { kind: 'intel', scoutReportId: reportId },
      'DRIVE_BY',
      30,
      key,
    );
    const second = await resolveAttackEncounter(
      attackerId,
      userId,
      { kind: 'intel', scoutReportId: reportId },
      'DRIVE_BY',
      30,
      key,
    );

    expect(second.idempotentReplay).toBe(true);
    expect(second.encounterId).toBe(first.encounterId);

    const turnsAfter = (await prisma.playerTurnState.findUniqueOrThrow({ where: { playerId: attackerId } }))
      .currentTurns;
    expect(turnsAfter).toBe(turnsBefore - first.turnsSpent);

    const encounterCount = await prisma.combatEncounter.count({ where: { attackerId, idempotencyKey: key } });
    expect(encounterCount).toBe(1);
  });

  it('different keys create separate attacks when eligible', async () => {
    const first = await resolveAttackEncounter(
      attackerId,
      userId,
      { kind: 'intel', scoutReportId: reportId },
      'DRIVE_BY',
      20,
      uuidv4(),
    );
    const second = await resolveAttackEncounter(
      attackerId,
      userId,
      { kind: 'intel', scoutReportId: reportId },
      'DRIVE_BY',
      20,
      uuidv4(),
    );
    expect(second.encounterId).not.toBe(first.encounterId);
    expect(second.idempotentReplay).toBe(false);
  });
});
