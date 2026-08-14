/**
 * READ-ONLY performance audit helper — profiles DB/query costs without Next.js imports.
 * Usage: npx tsx scripts/perf-audit-page-loaders.ts
 */
import { PrismaClient } from '@prisma/client';
import { NetWorthService } from '../NeonUnderworld-OldSkool/src/server/services/net-worth.service';

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

async function computeSeasonRankings(seasonId: string) {
  const players = await prisma.player.findMany({
    where: { seasonId, isSystemPlayer: false },
    include: { district: true, cartel: { select: { tag: true } }, user: { select: { lastLoginAt: true } }, statusExt: true },
  });
  const nw = await NetWorthService.calculateForPlayers(players);
  return { players: players.length, nw };
}

async function main() {
  const adminEmail = process.env.SEED_ADMIN_EMAIL ?? 'admin@neonunderworld.local';
  const admin = await prisma.user.findUnique({
    where: { email: adminEmail.toLowerCase() },
    include: {
      player: {
        include: { district: true, season: true, turnState: true, cartel: true, user: true, statusExt: true },
      },
    },
  });
  if (!admin?.player) throw new Error('Admin player not found');

  const playerId = admin.player.id;
  const seasonId = admin.player.seasonId;

  console.log('\n=== DB / QUERY PROFILING ===');
  console.log(`Player: ${admin.player.alias}\n`);

  console.log('--- Layout baseline queries ---');
  const layoutT0 = performance.now();
  await timed('player.findUniqueOrThrow (full include)', () =>
    prisma.player.findUniqueOrThrow({
      where: { id: playerId },
      include: { district: true, season: true, turnState: true, cartel: true, user: true, statusExt: true },
    }),
  );
  await timed('NetWorthService.calculateFromPlayerAsync', () =>
    NetWorthService.calculateFromPlayerAsync(admin.player),
  );
  await timed('report.findMany (unread count)', () =>
    prisma.report.findMany({ where: { playerId, read: false }, select: { id: true } }),
  );
  await timed('playerStatusExt upsert (touchLastSeen)', () =>
    prisma.playerStatusExt.upsert({
      where: { playerId },
      create: { playerId, lastSeenAt: new Date() },
      update: { lastSeenAt: new Date() },
    }),
  );
  console.log(`  TOTAL layout baseline: ${ms(layoutT0)}`);

  console.log('\n--- Rankings (full season, cold) ---');
  const rankT0 = performance.now();
  const rankResult = await timed('computeSeasonRankings', () => computeSeasonRankings(seasonId));
  console.log(`  Players ranked: ${rankResult.players}`);
  console.log(`  TOTAL rankings cold: ${ms(rankT0)}`);

  console.log('\n--- Rankings (warm repeat) ---');
  await timed('computeSeasonRankings (2nd)', () => computeSeasonRankings(seasonId));

  console.log('\n--- Attack page queries ---');
  const atkT0 = performance.now();
  const districtId = admin.player.districtId;
  const candidates = await timed('district player.findMany', () =>
    prisma.player.findMany({
      where: { seasonId, districtId, isSystemPlayer: false, id: { not: playerId } },
      include: { district: true, user: { select: { lastLoginAt: true } }, statusExt: true },
    }),
  );
  await timed(`NW batch (${candidates.length} candidates)`, () =>
    NetWorthService.calculateForPlayers(candidates),
  );
  await timed('report.findMany intel (take 100)', () =>
    prisma.report.findMany({
      where: { playerId, category: 'SCOUT' },
      orderBy: { createdAt: 'desc' },
      take: 100,
    }),
  );
  await timed('combatEncounter.groupBy 24h', () =>
    prisma.combatEncounter.groupBy({
      by: ['defenderId'],
      where: { attackerId: playerId, createdAt: { gte: new Date(Date.now() - 86400000) } },
      _count: { _all: true },
    }),
  );
  console.log(`  TOTAL attack queries: ${ms(atkT0)}`);

  console.log('\n--- Market settlement ---');
  const mktT0 = performance.now();
  const expiredCount = await timed('expired listing count', () =>
    prisma.marketListing.count({ where: { status: 'ACTIVE', expiresAt: { lt: new Date() } } }),
  );
  console.log(`  Expired listings pending: ${expiredCount}`);
  console.log(`  TOTAL market check: ${ms(mktT0)}`);

  console.log('\n--- Reports inbox ---');
  const repT0 = performance.now();
  const reportTotal = await timed('report.findMany (all, no limit)', () =>
    prisma.report.findMany({
      where: { playerId },
      orderBy: { createdAt: 'desc' },
    }),
  );
  console.log(`  Reports returned: ${reportTotal.length}`);
  console.log(`  TOTAL reports: ${ms(repT0)}`);

  console.log('\n--- Business settle (if any) ---');
  const bizCount = await prisma.business.count({ where: { playerId } });
  if (bizCount > 0) {
    const bizT0 = performance.now();
    await timed('business.findMany', () => prisma.business.findMany({ where: { playerId } }));
    console.log(`  Businesses: ${bizCount}, TOTAL: ${ms(bizT0)}`);
  } else {
    console.log('  No businesses');
  }

  console.log('\n--- Scale simulation ---');
  for (const n of [100, 500, 1000]) {
    const simT0 = performance.now();
    const simPlayers = await prisma.player.findMany({
      where: { seasonId, isSystemPlayer: false },
      take: n,
    });
    await NetWorthService.calculateForPlayers(simPlayers);
    console.log(`  NW batch ${simPlayers.length} players: ${ms(simT0)}`);
  }

  const totalPlayers = await prisma.player.count({ where: { seasonId, isSystemPlayer: false } });
  console.log(`\nCurrent season non-system players: ${totalPlayers}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
