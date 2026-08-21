/**
 * Resets market seller inventory for cartel+market E2E (admin account).
 * Clears active listings and restores tradable hash.
 */
import { PrismaClient } from '@prisma/client';
import { assertDevSeedAllowed } from './lib/dev-guard';

const prisma = new PrismaClient();

async function resetSellerMarket(email: string): Promise<void> {
  const user = await prisma.user.findUnique({
    where: { email: email.toLowerCase() },
    include: { player: { select: { id: true } } },
  });
  if (!user?.player) return;

  const playerId = user.player.id;
  const activeSeason = await prisma.season.findFirst({
    where: { status: 'ACTIVE' },
    orderBy: { number: 'desc' },
    select: { id: true },
  });
  const activeListings = await prisma.marketListing.findMany({
    where: { sellerId: playerId, status: 'ACTIVE' },
    select: { id: true },
  });

  for (const listing of activeListings) {
    await prisma.marketBid.deleteMany({ where: { listingId: listing.id } });
    await prisma.marketListing.delete({ where: { id: listing.id } });
  }

  await prisma.marketBid.deleteMany({ where: { bidderId: playerId } });
  await prisma.marketListing.deleteMany({ where: { sellerId: playerId } });

  await prisma.player.update({
    where: { id: playerId },
    data: {
      hash: 20,
      beer: 10,
      condoms: 10,
      glocks: 2,
      cash: 50_000,
      ...(activeSeason ? { seasonId: activeSeason.id } : {}),
    },
  });

  console.log(`Market seller ready: ${email} (${activeListings.length} stale listings cleared)`);
}

async function main() {
  assertDevSeedAllowed('e2e-market-seller-setup');
  const adminEmail = process.env.SEED_ADMIN_EMAIL ?? 'admin@neonunderworld.local';
  await resetSellerMarket(adminEmail);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
