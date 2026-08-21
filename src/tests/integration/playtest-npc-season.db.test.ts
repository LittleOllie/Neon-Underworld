import { describe, it, expect, afterAll } from 'vitest';
import { PrismaClient, SeasonStatus } from '@prisma/client';
import { hashPassword } from '@/lib/security/crypto';
import {
  reattachPlaytestNpcsToActiveSeason,
  requireExactlyOneActiveSeason,
} from '@/lib/game-engine/playtest-npc-season';

const prisma = new PrismaClient();
const runDbTests = process.env.CARTEL_DB_INTEGRATION !== '0';

describe.runIf(runDbTests)('playtest NPC season reattach (db)', () => {
  const createdPlayerIds: string[] = [];
  const createdUserIds: string[] = [];

  afterAll(async () => {
    if (createdPlayerIds.length > 0) {
      await prisma.npcProgressionState.deleteMany({
        where: { playerId: { in: createdPlayerIds } },
      });
      await prisma.player.deleteMany({ where: { id: { in: createdPlayerIds } } });
    }
    if (createdUserIds.length > 0) {
      await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
    }
    await prisma.$disconnect();
  });

  it('preserves assets and progression while reattaching seasonId', async () => {
    const active = await requireExactlyOneActiveSeason(prisma);
    const ended = await prisma.season.findFirst({
      where: { status: SeasonStatus.ENDED },
      orderBy: { number: 'desc' },
    });
    if (!ended) return;

    const district = await prisma.district.findFirstOrThrow();
    const suffix = Math.random().toString(36).slice(2, 8);
    const alias = `ReattachProbe${suffix}`;
    const aliasNormalized = alias.toLowerCase();

    const user = await prisma.user.create({
      data: {
        email: `playtest-npc+${aliasNormalized}@neonunderworld.local`,
        passwordHash: await hashPassword('test-not-for-login'),
        role: 'PLAYER',
      },
    });
    createdUserIds.push(user.id);

    const player = await prisma.player.create({
      data: {
        userId: user.id,
        alias,
        aliasNormalized,
        seasonId: ended.id,
        districtId: district.id,
        cash: 123_456,
        bankCash: 7_890,
        prostitutes: 17,
        thugs: 11,
      },
    });
    createdPlayerIds.push(player.id);

    await prisma.npcProgressionState.create({
      data: {
        playerId: player.id,
        archetype: 'OPERATOR',
        growthSeed: 4242,
        ladderSlot: 5,
        lastProgressedDay: 3,
      },
    });

    const human = await prisma.player.findFirst({
      where: {
        seasonId: active.id,
        isSystemPlayer: false,
        user: {
          NOT: {
            OR: [
              { email: { startsWith: 'playtest-npc+' } },
              { email: { startsWith: 'local-npc+' } },
              { email: { startsWith: 'dev-pvp+' } },
            ],
          },
        },
      },
      select: { id: true, seasonId: true, cash: true },
    });
    expect(human).toBeTruthy();
    const humanBefore = human!;

    const result = await reattachPlaytestNpcsToActiveSeason(prisma, active);
    expect(result.moved).toBeGreaterThanOrEqual(1);

    const reattached = await prisma.player.findUniqueOrThrow({ where: { id: player.id } });
    expect(reattached.seasonId).toBe(active.id);
    expect(reattached.cash).toBe(123_456);
    expect(reattached.bankCash).toBe(7_890);
    expect(reattached.prostitutes).toBe(17);
    expect(reattached.thugs).toBe(11);

    const progression = await prisma.npcProgressionState.findUniqueOrThrow({
      where: { playerId: player.id },
    });
    expect(progression.ladderSlot).toBe(5);
    expect(progression.growthSeed).toBe(4242);

    const humanAfter = await prisma.player.findUniqueOrThrow({ where: { id: humanBefore.id } });
    expect(humanAfter.seasonId).toBe(humanBefore.seasonId);
    expect(humanAfter.cash).toBe(humanBefore.cash);
  });
});
