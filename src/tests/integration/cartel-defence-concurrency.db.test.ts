import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { hashPassword } from '@/lib/security/crypto';
import { computeCartelResponseForce } from '@/lib/game-engine/cartel-response-force';
import { runSerializableTransaction } from '@/lib/db/serializable-transaction';

const prisma = new PrismaClient();
const runDbTests = process.env.CARTEL_DB_INTEGRATION !== '0';

async function createTestPlayer(
  alias: string,
  seasonId: string,
  districtId: string,
  thugs = 50,
): Promise<string> {
  const aliasNormalized = alias.toLowerCase();
  const user = await prisma.user.create({
    data: {
      email: `${aliasNormalized}@cartel-defence-db.local`,
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
      thugs,
    },
  });
  return player.id;
}

describe.skipIf(!runDbTests)('Cartel Response Force shared pool concurrency', () => {
  let cartelId = '';
  let defenderA = '';
  let defenderB = '';
  const initialPool = 100;
  const tag = `D${Date.now().toString(36).slice(-5).toUpperCase()}`;

  beforeAll(async () => {
    const season = await prisma.season.findFirst({ where: { status: 'ACTIVE' } });
    if (!season) throw new Error('No active season for DB integration test');

    const district = await prisma.district.findFirst();
    if (!district) throw new Error('No district for DB integration test');

    defenderA = await createTestPlayer(`DefA${Date.now().toString(36)}`, season.id, district.id, 50);
    defenderB = await createTestPlayer(`DefB${Date.now().toString(36)}`, season.id, district.id, 50);

    const cartel = await prisma.cartel.create({
      data: {
        name: `DefenceTest ${Date.now()}`,
        tag,
        leaderId: defenderA,
        thugs: initialPool,
        rides: 50,
        treasuryCash: 0,
      },
    });
    cartelId = cartel.id;
    await prisma.player.updateMany({
      where: { id: { in: [defenderA, defenderB] } },
      data: { cartelId: cartel.id },
    });
  });

  afterAll(async () => {
    if (cartelId) {
      const members = await prisma.player.findMany({ where: { cartelId }, select: { id: true } });
      await prisma.player.updateMany({
        where: { cartelId },
        data: { cartelId: null, cartelDonationPercent: 0 },
      });
      await prisma.cartel.delete({ where: { id: cartelId } }).catch(() => {});
      for (const m of members) {
        await prisma.player.delete({ where: { id: m.id } }).catch(() => {});
      }
    }
    await prisma.$disconnect();
  });

  it('serializes concurrent deployments and conserves cartel thugs', async () => {
    await prisma.cartel.update({
      where: { id: cartelId },
      data: { thugs: initialPool },
    });

    const attackCount = 5;
    const results = await Promise.all(
      Array.from({ length: attackCount }, (_, i) =>
        runSerializableTransaction(
          async (tx) => {
            await tx.$queryRaw`SELECT id FROM "Cartel" WHERE id = ${cartelId} FOR UPDATE`;
            const cartel = await tx.cartel.findUniqueOrThrow({ where: { id: cartelId } });
            const defenderId = i % 2 === 0 ? defenderA : defenderB;
            const defender = await tx.player.findUniqueOrThrow({ where: { id: defenderId } });
            const deployed = computeCartelResponseForce(defender.thugs, cartel.thugs, cartel.rides);
            const casualties = Math.min(deployed, 8);
            if (casualties > 0) {
              await tx.cartel.update({
                where: { id: cartelId },
                data: { thugs: { decrement: casualties } },
              });
            }
            return { deployed, casualties, poolBefore: cartel.thugs };
          },
          { maxAttempts: 20, timeout: 30_000 },
        ),
      ),
    );

    const totalCasualties = results.reduce((sum, r) => sum + r.casualties, 0);
    const finalCartel = await prisma.cartel.findUniqueOrThrow({ where: { id: cartelId } });

    expect(finalCartel.thugs).toBe(initialPool - totalCasualties);
    expect(finalCartel.thugs).toBeGreaterThanOrEqual(0);

    for (const r of results) {
      const maxAllowed = computeCartelResponseForce(50, r.poolBefore, 50);
      expect(r.deployed).toBeLessThanOrEqual(maxAllowed);
      expect(r.deployed).toBeLessThanOrEqual(r.poolBefore);
    }

    const duplicateFullPool = results.filter((r) => r.deployed === initialPool);
    expect(duplicateFullPool.length).toBeLessThanOrEqual(1);
  });
});
