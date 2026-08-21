#!/usr/bin/env npx tsx
/**
 * Dev/playtest only — remove local-npc+ Fix fixtures WITHOUT reseeding.
 *
 *   npm run db:remove:local-npcs
 *   npm run db:remove:local-npcs -- --dry-run
 *
 * Selects ONLY users with email prefix `local-npc+`.
 * Does not touch humans, playtest-npc+, dev-pvp+, or system players.
 */
import { PrismaClient, SeasonStatus } from '@prisma/client';
import { assertDevSeedAllowed } from './lib/dev-guard';
import {
  LOCAL_NPC_EMAIL_PREFIX,
  LOCAL_FIXTURE_CARTEL_TAGS,
  resetLocalNpcFixtures,
} from './lib/local-npc-seed';
import { PLAYTEST_NPC_EMAIL_PREFIX } from '../src/lib/game-engine/playtest-npc-season';
import { humanPlayerWhere } from '../src/lib/game-engine/human-player';
import {
  minAttackTargetNetWorth,
  maxAttackTargetNetWorth,
} from '../src/config/game/redlite-rules';
import { calculateCanonicalNetWorthFromPlayer } from '../src/lib/game-engine/canonical-net-worth';
import { aggregateBusinessNwContext } from '../src/server/services/business.service';

function seasonRankingsCacheTag(seasonId: string): string {
  return `season-rankings-${seasonId}`;
}

function fmt(n: number): string {
  return `$${n.toLocaleString()}`;
}

function parseArgs() {
  return { dryRun: process.argv.includes('--dry-run') };
}

async function requireActiveSeason(prisma: PrismaClient) {
  const season = await prisma.season.findFirst({
    where: { status: SeasonStatus.ACTIVE },
    orderBy: { number: 'desc' },
    select: { id: true, number: true },
  });
  if (!season) throw new Error('No active season found.');
  return season;
}

async function countByEmailPrefix(prisma: PrismaClient, prefix: string, seasonId?: string) {
  return prisma.player.count({
    where: {
      ...(seasonId ? { seasonId } : {}),
      user: { email: { startsWith: prefix } },
    },
  });
}

async function auditLocalFixtureDependencies(prisma: PrismaClient, playerIds: string[]) {
  if (playerIds.length === 0) {
    return {
      reports: 0,
      combatAsAttacker: 0,
      combatAsDefender: 0,
      scoutResults: 0,
      rankSnapshots: 0,
      npcProgression: 0,
      cartelMembers: 0,
      marketListings: 0,
      businesses: 0,
      gameActions: 0,
    };
  }

  const [
    reports,
    combatAsAttacker,
    combatAsDefender,
    scoutResults,
    rankSnapshots,
    npcProgression,
    cartelMembers,
    marketListings,
    businesses,
    gameActions,
  ] = await Promise.all([
    prisma.report.count({ where: { playerId: { in: playerIds } } }),
    prisma.combatEncounter.count({ where: { attackerId: { in: playerIds } } }),
    prisma.combatEncounter.count({ where: { defenderId: { in: playerIds } } }),
    prisma.scoutResult.count({ where: { playerId: { in: playerIds } } }),
    prisma.rankSnapshot.count({ where: { playerId: { in: playerIds } } }),
    prisma.npcProgressionState.count({ where: { playerId: { in: playerIds } } }),
    prisma.player.count({ where: { id: { in: playerIds }, cartelId: { not: null } } }),
    prisma.marketListing.count({ where: { sellerId: { in: playerIds } } }),
    prisma.business.count({ where: { playerId: { in: playerIds } } }),
    prisma.gameAction.count({ where: { playerId: { in: playerIds } } }),
  ]);

  return {
    reports,
    combatAsAttacker,
    combatAsDefender,
    scoutResults,
    rankSnapshots,
    npcProgression,
    cartelMembers,
    marketListings,
    businesses,
    gameActions,
  };
}

async function auditWorld(prisma: PrismaClient, seasonId: string) {
  const [
    localNpcTotal,
    localNpcOnSeason,
    playtestNpcTotal,
    playtestNpcOnSeason,
    devPvpTotal,
    humanTotal,
    humanOnSeason,
    fixAliasOnSeason,
    rankingsParticipants,
    fixtureCartels,
  ] = await Promise.all([
    countByEmailPrefix(prisma, LOCAL_NPC_EMAIL_PREFIX),
    countByEmailPrefix(prisma, LOCAL_NPC_EMAIL_PREFIX, seasonId),
    countByEmailPrefix(prisma, PLAYTEST_NPC_EMAIL_PREFIX),
    countByEmailPrefix(prisma, PLAYTEST_NPC_EMAIL_PREFIX, seasonId),
    countByEmailPrefix(prisma, 'dev-pvp+'),
    prisma.player.count({ where: humanPlayerWhere(seasonId) }),
    prisma.player.count({ where: { ...humanPlayerWhere(seasonId), seasonId } }),
    prisma.player.count({
      where: {
        seasonId,
        alias: { startsWith: 'Fix' },
        NOT: { user: { email: { startsWith: LOCAL_NPC_EMAIL_PREFIX } } },
      },
    }),
    prisma.player.count({
      where: {
        seasonId,
        OR: [
          { user: { email: { startsWith: PLAYTEST_NPC_EMAIL_PREFIX } } },
          { user: { email: { startsWith: 'dev-pvp+' } } },
          humanPlayerWhere(seasonId),
        ],
      },
    }),
    prisma.cartel.count({ where: { tag: { in: [...LOCAL_FIXTURE_CARTEL_TAGS] } } }),
  ]);

  return {
    localNpcTotal,
    localNpcOnSeason,
    playtestNpcTotal,
    playtestNpcOnSeason,
    devPvpTotal,
    humanTotal,
    humanOnSeason,
    fixAliasOnSeason,
    rankingsParticipants,
    fixtureCartels,
  };
}

async function reportHerman(prisma: PrismaClient) {
  const herman = await prisma.player.findFirst({
    where: { aliasNormalized: 'herman' },
    include: { ownedBusinesses: true, district: { select: { slug: true, name: true } } },
  });
  if (!herman) {
    console.log('\nHerman check: no player with alias "herman" found.');
    return null;
  }

  const nw = calculateCanonicalNetWorthFromPlayer(
    herman,
    aggregateBusinessNwContext(herman.ownedBusinesses),
  );
  const minT = minAttackTargetNetWorth(nw);
  const maxT = maxAttackTargetNetWorth(nw);

  const districtNpcs = await prisma.player.findMany({
    where: {
      districtId: herman.districtId,
      user: { email: { startsWith: PLAYTEST_NPC_EMAIL_PREFIX } },
    },
    include: { ownedBusinesses: true },
    orderBy: { aliasNormalized: 'asc' },
  });

  const eligible = districtNpcs
    .map((npc) => ({
      alias: npc.alias,
      netWorth: calculateCanonicalNetWorthFromPlayer(npc, aggregateBusinessNwContext(npc.ownedBusinesses)),
    }))
    .filter((n) => n.netWorth >= minT && n.netWorth <= maxT);

  console.log('\n--- Herman check ---');
  console.log(`Influence: ${fmt(nw)}`);
  console.log(`Attack range (60%–170%): ${fmt(minT)} – ${fmt(maxT)}`);
  console.log(`District: ${herman.district?.name ?? herman.districtId}`);
  console.log(`Dynamic playtest targets in range: ${eligible.length}`);
  for (const t of eligible) {
    console.log(`  · ${t.alias} — ${fmt(t.netWorth)}`);
  }

  return { nw, minT, maxT, district: herman.district?.name ?? herman.districtId, eligible };
}

async function tryRevalidateRankings(seasonId: string) {
  const appUrl = process.env.APP_URL ?? 'http://localhost:3100';
  const ports = [
    new URL(appUrl).port || (appUrl.includes('https') ? '443' : '80'),
    process.env.PORT,
    '3302',
    '3100',
  ].filter(Boolean) as string[];

  const bases = [
    appUrl.replace(/\/$/, ''),
    ...ports.map((port) => `http://localhost:${port}`),
  ];
  const seen = new Set<string>();

  for (const base of bases) {
    if (seen.has(base)) continue;
    seen.add(base);
    const url = `${base}/api/dev/revalidate-rankings`;

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ seasonId }),
      });
      if (!response.ok) continue;
      const json = (await response.json()) as { ok?: boolean; tag?: string };
      console.log(`\nRankings cache: revalidated via ${base} — tag ${json.tag ?? seasonRankingsCacheTag(seasonId)}`);
      return true;
    } catch {
      // try next base
    }
  }

  console.log('\nRankings cache: could not reach dev server — POST manually when dev is running.');
  console.log(`  tag: ${seasonRankingsCacheTag(seasonId)}`);
  return false;
}

async function main() {
  assertDevSeedAllowed('remove-local-npcs');
  const { dryRun } = parseArgs();
  const prisma = new PrismaClient();

  try {
    const season = await requireActiveSeason(prisma);
    console.log(`Active season: #${season.number} (${season.id})`);
    console.log(`NPC_PROGRESSION_INCLUDE_LOCAL=${process.env.NPC_PROGRESSION_INCLUDE_LOCAL ?? '(unset)'}`);

    const fixtureUsers = await prisma.user.findMany({
      where: { email: { startsWith: LOCAL_NPC_EMAIL_PREFIX } },
      select: {
        id: true,
        email: true,
        player: { select: { id: true, alias: true, seasonId: true } },
      },
    });
    const playerIds = fixtureUsers.flatMap((u) => (u.player ? [u.player.id] : []));

    console.log('\n=== PRE-CLEANUP AUDIT ===');
    console.log(`local-npc+ accounts: ${fixtureUsers.length}`);
    console.log(
      `  on active season: ${fixtureUsers.filter((u) => u.player?.seasonId === season.id).length}`,
    );
    if (fixtureUsers.length > 0) {
      console.log('  sample aliases:', fixtureUsers.slice(0, 5).map((u) => u.player?.alias).join(', '));
    }

    const before = await auditWorld(prisma, season.id);
    console.log(`playtest-npc+ (active season): ${before.playtestNpcOnSeason} / ${before.playtestNpcTotal} total`);
    console.log(`humans (active season): ${before.humanOnSeason}`);
    console.log(`Fix-alias non-local-npc (active season): ${before.fixAliasOnSeason}`);
    console.log(`rankings participants (est.): ${before.rankingsParticipants}`);
    console.log(`fixture cartels (LFX-*): ${before.fixtureCartels}`);

    const deps = await auditLocalFixtureDependencies(prisma, playerIds);
    console.log('\nDependent records on local-npc+ players:');
    console.log(JSON.stringify(deps, null, 2));

    if (dryRun) {
      console.log('\nDRY RUN — no deletions performed.');
      await reportHerman(prisma);
      return;
    }

    if (fixtureUsers.length === 0) {
      console.log('\nNo local-npc+ fixtures to remove.');
    } else {
      console.log('\n=== REMOVING LOCAL FIXTURES ===');
      const removed = await resetLocalNpcFixtures(prisma);
      console.log(`Removed ${removed} local-npc+ user account(s) (Player cascade deletes dependencies).`);
    }

    console.log('\n=== POST-CLEANUP AUDIT ===');
    const after = await auditWorld(prisma, season.id);
    console.log(`local-npc+ remaining: ${after.localNpcTotal}`);
    console.log(`playtest-npc+ (active season): ${after.playtestNpcOnSeason}`);
    console.log(`humans (active season): ${after.humanOnSeason}`);
    console.log(`Fix-alias non-local-npc (active season): ${after.fixAliasOnSeason}`);
    console.log(`rankings participants (est.): ${after.rankingsParticipants}`);
    console.log(`fixture cartels (LFX-*): ${after.fixtureCartels}`);

    const fixAliasesLeft = await prisma.player.findMany({
      where: {
        seasonId: season.id,
        user: { email: { startsWith: LOCAL_NPC_EMAIL_PREFIX } },
      },
      select: { alias: true },
      take: 5,
    });
    if (fixAliasesLeft.length > 0) {
      console.log('WARNING: local Fix fixtures still present:', fixAliasesLeft.map((p) => p.alias).join(', '));
    } else {
      console.log('No local-npc+ Fix fixtures remain on active season.');
    }

    await tryRevalidateRankings(season.id);
    await reportHerman(prisma);

    console.log('\nFixture tooling preserved: scripts/lib/local-npc-seed.ts, npm run seed:npcs');
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
