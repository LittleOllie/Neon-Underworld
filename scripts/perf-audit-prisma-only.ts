/**
 * READ-ONLY performance audit — prisma-only timings (no Next.js path aliases).
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

function ms(start: number) {
  return `${(performance.now() - start).toFixed(1)}ms`;
}

async function timed<T>(label: string, fn: () => Promise<T>): Promise<T> {
  const t0 = performance.now();
  const result = await fn();
  console.log(`  ${label}: ${ms(t0)}`);
  return result;
}

async function main() {
  const adminEmail = process.env.SEED_ADMIN_EMAIL ?? 'admin@neonunderworld.local';
  const admin = await prisma.user.findUnique({
    where: { email: adminEmail.toLowerCase() },
    include: { player: true },
  });
  if (!admin?.player) throw new Error('Admin not found');

  const { id: playerId, seasonId, districtId } = admin.player;

  console.log('\n=== PRISMA QUERY TIMINGS ===\n');

  console.log('--- Layout baseline ---');
  const layoutT0 = performance.now();
  await timed('player full include', () =>
    prisma.player.findUniqueOrThrow({
      where: { id: playerId },
      include: { district: true, season: true, turnState: true, cartel: true, user: true, statusExt: true },
    }),
  );
  await timed('business.findMany (NW helper)', () =>
    prisma.business.findMany({ where: { playerId } }),
  );
  await timed('report unread scan', () =>
    prisma.report.findMany({ where: { playerId, read: false }, select: { id: true } }),
  );
  await timed('touchLastSeen upsert', () =>
    prisma.playerStatusExt.upsert({
      where: { playerId },
      create: { playerId, lastSeenAt: new Date() },
      update: { lastSeenAt: new Date() },
    }),
  );
  console.log(`  TOTAL: ${ms(layoutT0)}`);

  console.log('\n--- Rankings cold (player load only) ---');
  const rankT0 = performance.now();
  const allPlayers = await timed('season player.findMany', () =>
    prisma.player.findMany({
      where: { seasonId, isSystemPlayer: false },
      include: { district: true, cartel: { select: { tag: true } }, user: { select: { lastLoginAt: true } }, statusExt: true },
    }),
  );
  await timed('business.findMany all owners', () =>
    prisma.business.findMany({ where: { playerId: { in: allPlayers.map((p) => p.id) } } }),
  );
  console.log(`  Players: ${allPlayers.length}, TOTAL: ${ms(rankT0)}`);

  console.log('\n--- Attack page ---');
  const atkT0 = performance.now();
  const candidates = await timed('district candidates', () =>
    prisma.player.findMany({
      where: { seasonId, districtId, isSystemPlayer: false, id: { not: playerId } },
    }),
  );
  await timed('intel reports x2', async () => {
    await prisma.report.findMany({ where: { playerId, category: 'SCOUT' }, take: 100 });
    await prisma.report.findMany({ where: { playerId, category: 'SCOUT' }, take: 100 });
  });
  await timed('combatEncounter groupBy', () =>
    prisma.combatEncounter.groupBy({
      by: ['defenderId'],
      where: { attackerId: playerId, createdAt: { gte: new Date(Date.now() - 86400000) } },
      _count: { _all: true },
    }),
  );
  console.log(`  Candidates: ${candidates.length}, TOTAL: ${ms(atkT0)}`);

  console.log('\n--- Market ---');
  const expired = await timed('expired listings count', () =>
    prisma.marketListing.count({ where: { status: 'ACTIVE', endsAt: { lt: new Date() } } }),
  );
  const active = await timed('active listings count', () =>
    prisma.marketListing.count({ where: { status: 'ACTIVE' } }),
  );
  console.log(`  Expired: ${expired}, Active: ${active}`);

  console.log('\n--- Reports ---');
  const reports = await timed('all reports (no limit)', () =>
    prisma.report.findMany({ where: { playerId }, orderBy: { createdAt: 'desc' } }),
  );
  console.log(`  Count: ${reports.length}`);

  console.log('\n--- Cartel ---');
  await timed('cartel page player reload', () =>
    prisma.player.findUniqueOrThrow({
      where: { id: playerId },
      include: { cartel: { include: { members: { include: { player: true } } } } },
    }),
  );

  const total = await prisma.player.count({ where: { seasonId, isSystemPlayer: false } });
  console.log(`\nSeason players (non-system): ${total}`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
