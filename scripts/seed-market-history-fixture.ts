/**
 * Seeds a seller with heavy market history for My Auctions pagination tests.
 * Usage: npx tsx scripts/seed-market-history-fixture.ts
 */
import { PrismaClient } from '@prisma/client';
import { assertDevSeedAllowed } from './lib/dev-guard';

const prisma = new PrismaClient();

const FIXTURE_EMAIL = process.env.MARKET_FIXTURE_EMAIL ?? 'admin@neonunderworld.local';

async function main() {
  assertDevSeedAllowed('seed-market-history-fixture');

  const user = await prisma.user.findUnique({
    where: { email: FIXTURE_EMAIL.toLowerCase() },
    include: { player: { select: { id: true, seasonId: true } } },
  });
  if (!user?.player) throw new Error(`Player not found: ${FIXTURE_EMAIL}`);

  const playerId = user.player.id;
  const existingIds = await prisma.marketListing.findMany({
    where: { sellerId: playerId },
    select: { id: true },
  });
  if (existingIds.length > 0) {
    await prisma.marketBid.deleteMany({
      where: { listingId: { in: existingIds.map((l) => l.id) } },
    });
  }
  await prisma.marketListing.deleteMany({ where: { sellerId: playerId } });

  const now = Date.now();
  const rows = [];
  for (let i = 0; i < 55; i++) {
    rows.push({
      sellerId: playerId,
      itemKey: 'glock',
      quantity: 1,
      startingPrice: 100 + i,
      endsAt: new Date(now - 86_400_000 - i * 60_000),
      status: (i % 2 === 0 ? 'SETTLED' : 'EXPIRED') as 'SETTLED' | 'EXPIRED',
      settledAt: new Date(now - 86_400_000 - i * 60_000),
      createdAt: new Date(now - 86_400_000 - i * 60_000),
    });
  }
  await prisma.marketListing.createMany({ data: rows });

  await prisma.player.update({
    where: { id: playerId },
    data: { hash: 30, glocks: 10, cash: 50_000 },
  });

  console.log(JSON.stringify({ playerId, historyListings: rows.length, hash: 30 }));
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
