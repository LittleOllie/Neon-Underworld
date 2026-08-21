#!/usr/bin/env node
/**
 * Restore trial play without wiping player progress.
 * - Re-activates the season most human accounts are on
 * - Ends stray ACTIVE seasons left by integration tests
 *
 * Usage: node scripts/repair-trial-season.mjs
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const HUMAN_FILTER = {
  isSystemPlayer: false,
  NOT: {
    OR: [
      { user: { email: { startsWith: 'playtest-npc+' } } },
      { user: { email: { startsWith: 'dev-pvp+' } } },
      { user: { email: { startsWith: 'system+' } } },
    ],
  },
};

async function main() {
  const grouped = await prisma.player.groupBy({
    by: ['seasonId'],
    where: HUMAN_FILTER,
    _count: { id: true },
    orderBy: { _count: { id: 'desc' } },
  });

  if (grouped.length === 0) {
    console.log('No human players found — nothing to repair.');
    return;
  }

  const primarySeasonId = grouped[0].seasonId;
  const primary = await prisma.season.findUniqueOrThrow({ where: { id: primarySeasonId } });

  const reactivated =
    primary.status !== 'ACTIVE'
      ? await prisma.season.update({
          where: { id: primarySeasonId },
          data: { status: 'ACTIVE' },
        })
      : primary;

  const endedOthers = await prisma.season.updateMany({
    where: { status: 'ACTIVE', id: { not: primarySeasonId } },
    data: { status: 'ENDED' },
  });

  console.log(
    `Trial season repaired: Round #${reactivated.number} (${reactivated.name}) is ACTIVE with ${grouped[0]._count.id} human player(s).`,
  );
  if (endedOthers.count > 0) {
    console.log(`Ended ${endedOthers.count} stray ACTIVE season(s) from test runs.`);
  }
  console.log('Player progress was not reset.');
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
