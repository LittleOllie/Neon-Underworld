#!/usr/bin/env npx tsx
/**
 * Dev/playtest only — reset playtest-npc+ ladder state for the active season.
 *
 *   npm run db:reset:playtest-npcs
 *   npm run db:reset:playtest-npcs -- --dry-run
 *   npm run db:reset:playtest-npcs -- --use-season-day
 */
import { PrismaClient } from '@prisma/client';
import { resetPlaytestNpcsForActiveSeason } from '../src/lib/game-engine/playtest-npc-round-init';
import {
  minAttackTargetNetWorth,
  maxAttackTargetNetWorth,
} from '../src/config/game/redlite-rules';
import { calculateCanonicalNetWorthFromPlayer } from '../src/lib/game-engine/canonical-net-worth';
import { aggregateBusinessNwContext } from '../src/server/services/business.service';
import { PLAYTEST_NPC_EMAIL_PREFIX } from '../src/lib/game-engine/playtest-npc-season';
import { NPC_LOCAL_FIXTURE_PREFIX } from '../src/config/game/npc-progression-rules';

function parseArgs() {
  const args = process.argv.slice(2);
  let roundDay: number | undefined;
  let useSeasonDay = false;
  let dryRun = false;

  for (const arg of args) {
    if (arg === '--dry-run') dryRun = true;
    else if (arg === '--use-season-day') useSeasonDay = true;
    else if (arg.startsWith('--day=')) roundDay = parseInt(arg.split('=')[1]!, 10);
    else if (arg === '--day' && args[args.indexOf(arg) + 1]) {
      roundDay = parseInt(args[args.indexOf(arg) + 1]!, 10);
    }
  }

  return { roundDay, useSeasonDay, dryRun };
}

function fmt(n: number): string {
  return `$${n.toLocaleString()}`;
}

async function reportHerman(prisma: PrismaClient) {
  const herman = await prisma.player.findFirst({
    where: { aliasNormalized: 'herman' },
    include: { ownedBusinesses: true, district: { select: { slug: true, name: true } } },
  });
  if (!herman) {
    console.log('\nHerman check: no player with alias "herman" found.');
    return;
  }

  const nw = calculateCanonicalNetWorthFromPlayer(
    herman,
    aggregateBusinessNwContext(herman.ownedBusinesses),
  );
  const minT = minAttackTargetNetWorth(nw);
  const maxT = maxAttackTargetNetWorth(nw);

  const dockNpcs = await prisma.player.findMany({
    where: {
      districtId: herman.districtId,
      user: { email: { startsWith: PLAYTEST_NPC_EMAIL_PREFIX } },
    },
    include: { ownedBusinesses: true },
    orderBy: { aliasNormalized: 'asc' },
  });

  const eligible = dockNpcs
    .map((npc) => ({
      alias: npc.alias,
      netWorth: calculateCanonicalNetWorthFromPlayer(npc, aggregateBusinessNwContext(npc.ownedBusinesses)),
    }))
    .filter((n) => n.netWorth >= minT && n.netWorth <= maxT);

  console.log('\n--- Herman check ---');
  console.log(`Influence: ${fmt(nw)}`);
  console.log(`Attack range (60%–170%): ${fmt(minT)} – ${fmt(maxT)}`);
  console.log(`District: ${herman.district?.name ?? herman.districtId}`);
  console.log(`Docklands dynamic playtest targets in range: ${eligible.length}`);
  for (const t of eligible) {
    console.log(`  · ${t.alias} — ${fmt(t.netWorth)}`);
  }
}

async function main() {
  const { assertDevSeedAllowed } = await import('./lib/dev-guard');
  assertDevSeedAllowed('reset-playtest-npcs');

  const { roundDay, useSeasonDay, dryRun } = parseArgs();
  const prisma = new PrismaClient();

  try {
    console.log(
      dryRun
        ? 'DRY RUN — playtest NPC reset preview'
        : 'Resetting playtest-npc+ population for active season…',
    );

    const result = await resetPlaytestNpcsForActiveSeason(prisma, {
      roundDay,
      useSeasonDay,
      dryRun,
    });

    console.log(`\nActive season: ${result.activeSeason.number}`);
    console.log(`Round day applied: ${result.roundDay}`);
    console.log(`NPCs ${dryRun ? 'previewed' : 'reset'}: ${result.resetCount}`);
    if (result.reattached > 0) {
      console.log(`Reattached to active season: ${result.reattached}`);
    }

    console.log('\nOverall NW distribution (playtest-npc+):');
    console.log(
      `  min ${fmt(result.distribution.min)} · p25 ${fmt(result.distribution.p25)} · median ${fmt(result.distribution.median)} · p75 ${fmt(result.distribution.p75)} · max ${fmt(result.distribution.max)}`,
    );

    console.log('\nPer district:');
    for (const [slug, stats] of Object.entries(result.byDistrict)) {
      console.log(
        `  ${slug}: n=${stats.count} min=${fmt(stats.min)} median=${fmt(stats.median)} max=${fmt(stats.max)}`,
      );
    }

    console.log('\nAttack coverage (60%–170%, dynamic playtest NPCs only):');
    for (const row of result.attackCoverage) {
      console.log(
        `  Attacker ${fmt(row.attackerNw)} → ${row.totalEligible} targets (${fmt(row.minTarget)}–${fmt(row.maxTarget)})`,
      );
      for (const [district, bucket] of Object.entries(row.byDistrict)) {
        if (bucket.count === 0) continue;
        console.log(
          `    ${district}: ${bucket.count} (low ${bucket.lowest?.alias} ${fmt(bucket.lowest?.netWorth ?? 0)}, high ${bucket.highest?.alias} ${fmt(bucket.highest?.netWorth ?? 0)})`,
        );
      }
    }

    const fixCount = await prisma.player.count({
      where: { user: { email: { startsWith: NPC_LOCAL_FIXTURE_PREFIX } } },
    });
    console.log(`\nFix NPCs (local-npc+) untouched: ${fixCount} accounts`);

    if (!dryRun) {
      await reportHerman(prisma);
    }
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
