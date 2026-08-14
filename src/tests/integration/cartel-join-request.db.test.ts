import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { hashPassword } from '@/lib/security/crypto';

const prisma = new PrismaClient();
const runDbTests = process.env.CARTEL_DB_INTEGRATION !== '0';

async function createTestPlayer(
  alias: string,
  seasonId: string,
  districtId: string,
): Promise<string> {
  const aliasNormalized = alias.toLowerCase();
  const user = await prisma.user.create({
    data: {
      email: `${aliasNormalized}@cartel-db-test.local`,
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
    },
  });
  return player.id;
}

describe.skipIf(!runDbTests)('CartelJoinRequest DB hardening', () => {
  let cartelId = '';
  let applicantId = '';
  let leaderId = '';
  const tag = `T${Date.now().toString(36).slice(-5).toUpperCase()}`;

  beforeAll(async () => {
    const season = await prisma.season.findFirst({ where: { status: 'ACTIVE' } });
    if (!season) throw new Error('No active season for DB integration test');

    const district = await prisma.district.findFirst();
    if (!district) throw new Error('No district for DB integration test');

    applicantId = await createTestPlayer(`JoinReq${Date.now().toString(36)}`, season.id, district.id);
    leaderId = await createTestPlayer(`JoinLead${Date.now().toString(36)}`, season.id, district.id);

    const cartel = await prisma.cartel.create({
      data: {
        name: `JoinTest ${Date.now()}`,
        tag,
        leaderId,
      },
    });
    cartelId = cartel.id;
    await prisma.player.update({
      where: { id: leaderId },
      data: { cartelId: cartel.id },
    });
  });

  afterAll(async () => {
    if (cartelId) {
      await prisma.cartelJoinRequest.deleteMany({ where: { cartelId } });
      const members = await prisma.player.findMany({ where: { cartelId }, select: { id: true } });
      await prisma.player.updateMany({ where: { cartelId }, data: { cartelId: null, cartelDonationPercent: 0 } });
      await prisma.cartel.delete({ where: { id: cartelId } }).catch(() => {});
      for (const m of members) {
        await prisma.player.delete({ where: { id: m.id } }).catch(() => {});
      }
    }
    if (applicantId) {
      await prisma.player.delete({ where: { id: applicantId } }).catch(() => {});
    }
    await prisma.$disconnect();
  });

  it('allows only one pending request per cartel/applicant under concurrency', async () => {
    const { CartelService } = await import('@/server/services/cartel.service');
    const results = await Promise.allSettled([
      CartelService.requestToJoin(applicantId, cartelId),
      CartelService.requestToJoin(applicantId, cartelId),
    ]);

    const fulfilled = results.filter((r) => r.status === 'fulfilled');
    const rejected = results.filter((r) => r.status === 'rejected');
    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);

    const rejection = (rejected[0] as PromiseRejectedResult).reason as {
      gameplayCode?: string;
      code?: string;
    };
    const duplicateBlocked =
      rejection?.gameplayCode === 'CARTEL_JOIN_REQUEST_EXISTS' || rejection?.code === 'P2002';
    const conflictBlocked = rejection?.code === 'P2034';
    expect(duplicateBlocked || conflictBlocked).toBe(true);

    const pending = await prisma.cartelJoinRequest.count({
      where: { cartelId, applicantId, status: 'PENDING' },
    });
    expect(pending).toBe(1);
  });

  it('preserves declined request history while allowing a new pending request', async () => {
    const pending = await prisma.cartelJoinRequest.findFirst({
      where: { cartelId, applicantId, status: 'PENDING' },
    });
    expect(pending).toBeTruthy();
    if (!pending) return;

    await prisma.cartelJoinRequest.update({
      where: { id: pending.id },
      data: { status: 'DECLINED' },
    });

    const { CartelService } = await import('@/server/services/cartel.service');
    const next = await CartelService.requestToJoin(applicantId, cartelId);
    expect(next.status).toBe('PENDING');

    const history = await prisma.cartelJoinRequest.count({
      where: { cartelId, applicantId },
    });
    expect(history).toBeGreaterThanOrEqual(2);
  });
});
