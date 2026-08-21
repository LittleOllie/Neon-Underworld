#!/usr/bin/env npx tsx
/**
 * One-time safe repair — reattach playtest-npc+ players to the active season.
 *
 *   npm run db:reattach-playtest-npcs
 */
import { PrismaClient } from '@prisma/client';
import { calculateCanonicalNetWorthFromPlayer } from '../src/lib/game-engine/canonical-net-worth';
import { isVisibleSeasonParticipant } from '../src/lib/game-engine/human-player';
import {
  reattachPlaytestNpcsToActiveSeason,
  requireExactlyOneActiveSeason,
  tryRevalidateRankingsCache,
} from '../src/lib/game-engine/playtest-npc-season';
import { listActivatedHumanPlayerIds } from '../src/lib/db/admin-analytics-db';
import { isAdminSchemaReady } from '../src/lib/db/admin-schema-readiness';
import { aggregateBusinessNwContext } from '../src/server/services/business.service';

async function verifyRankingsParticipants(prisma: PrismaClient, seasonId: string) {
  const adminReady = await isAdminSchemaReady();
  const activated = adminReady ? new Set(await listActivatedHumanPlayerIds(seasonId)) : null;

  const players = await prisma.player.findMany({
    where: { seasonId, isSystemPlayer: false },
    include: { user: { select: { email: true } }, ownedBusinesses: true },
  });

  const visible = players.filter((p) =>
    isVisibleSeasonParticipant(
      { id: p.id, isSystemPlayer: p.isSystemPlayer, email: p.user.email },
      activated,
    ),
  );

  const sampleBefore = await prisma.player.findFirst({
    where: { user: { email: { startsWith: 'playtest-npc+' } } },
    include: { ownedBusinesses: true },
  });

  return {
    adminReady,
    total: visible.length,
    humans: visible.filter(
      (p) =>
        !p.user.email.startsWith('playtest-npc+') &&
        !p.user.email.startsWith('local-npc+') &&
        !p.user.email.startsWith('dev-pvp+'),
    ).length,
    localNpc: visible.filter((p) => p.user.email.startsWith('local-npc+')).length,
    playtestNpc: visible.filter((p) => p.user.email.startsWith('playtest-npc+')).length,
    devPvp: visible.filter((p) => p.user.email.startsWith('dev-pvp+')).length,
    samplePlaytestNw: sampleBefore
      ? calculateCanonicalNetWorthFromPlayer(
          sampleBefore,
          aggregateBusinessNwContext(sampleBefore.ownedBusinesses),
        )
      : null,
  };
}

const prisma = new PrismaClient();

async function main() {
  const { assertDevSeedAllowed } = await import('./lib/dev-guard');
  assertDevSeedAllowed('reattach-playtest-npcs-season');

  const beforeSeason = await requireExactlyOneActiveSeason(prisma);
  console.log(`Active season: ${beforeSeason.number} (${beforeSeason.id})`);

  const assetSample = await prisma.player.findFirst({
    where: {
      user: { email: { startsWith: 'playtest-npc+' } },
      seasonId: { not: beforeSeason.id },
    },
    select: {
      id: true,
      alias: true,
      cash: true,
      prostitutes: true,
      thugs: true,
      bankCash: true,
      seasonId: true,
    },
  });

  const result = await reattachPlaytestNpcsToActiveSeason(prisma, beforeSeason);

  console.log(`Playtest NPCs reattached: ${result.moved}`);
  console.log(`Already on active season: ${result.alreadyOnActive}`);
  console.log(`Total playtest-npc+ accounts: ${result.totalPlaytestNpcs}`);

  if (result.previousSeasons.length > 0) {
    for (const prev of result.previousSeasons) {
      console.log(
        `  From season ${prev.seasonNumber} (${prev.seasonId}): ${prev.count} NPC(s) → season ${result.activeSeason.number} (${result.activeSeason.id})`,
      );
    }
  }

  const invalidated = await tryRevalidateRankingsCache(result.activeSeason.id);
  if (invalidated) {
    console.log(`Rankings cache invalidated for season ${result.activeSeason.id}.`);
  } else {
    console.warn('Rankings cache not invalidated — restart npm run dev if Rankings look stale.');
  }

  if (assetSample) {
    const after = await prisma.player.findUniqueOrThrow({
      where: { id: assetSample.id },
      select: {
        cash: true,
        prostitutes: true,
        thugs: true,
        bankCash: true,
        seasonId: true,
      },
    });
    const preserved =
      after.cash === assetSample.cash &&
      after.prostitutes === assetSample.prostitutes &&
      after.thugs === assetSample.thugs &&
      after.bankCash === assetSample.bankCash &&
      after.seasonId === beforeSeason.id;
    console.log(
      `Asset preservation check (${assetSample.alias}): ${preserved ? 'OK' : 'MISMATCH'}`,
    );
  }

  const participants = await verifyRankingsParticipants(prisma, beforeSeason.id);
  console.log('Active-season Rankings participants:', participants);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
