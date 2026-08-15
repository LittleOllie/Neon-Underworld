/**
 * Seeds 50 attackable playtest NPCs (isSystemPlayer: false) for friend alpha testing.
 * Safe to re-run — skips existing aliases; optionally jitters existing NPC resources.
 *
 *   npm run db:seed:playtest-npcs
 *   SEED_NPC_JITTER=true npm run db:seed:playtest-npcs
 */
import type { PrismaClient } from '@prisma/client';
import { SeasonStatus } from '@prisma/client';
import {
  hashPassword,
  normalizeAlias,
} from '../src/lib/security/crypto';
import { TURNS_CONFIG } from '../src/config/game/balance';
import { createInitialTurnState } from '../src/lib/game-engine/turns';
import { calculateNetWorth } from '../src/lib/game-engine/net-worth';
import { playerToResources } from '../src/lib/game-engine/state';
import {
  calculateProstituteHappiness,
  calculateThugHappiness,
} from '../src/lib/game-engine/happiness';
import { createSeededRng } from '../src/lib/game-engine/rng';
import { resolveNpcSeedAvatar } from '../src/lib/game-engine/npc-avatar';

export const PLAYTEST_NPC_COUNT = 50;
const PLAYTEST_NPC_EMAIL_PREFIX = 'playtest-npc+';

const NAME_PARTS = [
  'Neon', 'Dock', 'Grid', 'Velvet', 'Cipher', 'Ash', 'Wire', 'Pulse', 'Rust', 'Harbor',
  'Strip', 'Quarter', 'Lantern', 'Fleet', 'Mirror', 'Quiet', 'Silver', 'Brass', 'Copper', 'Obsidian',
  'Runner', 'Wolf', 'King', 'Ghost', 'Baron', 'Strike', 'Heir', 'Broker', 'Phantom', 'Regent',
  'Syndicate', 'Warden', 'Collector', 'Signal', 'Serpent', 'Saint', 'Duke', 'Consul', 'Monarch', 'Auditor',
] as const;

const DISTRICT_SLUGS = ['neon-strip', 'docklands', 'old-quarter'] as const;

function playtestNpcAlias(index: number): string {
  const a = NAME_PARTS[index % 20]!;
  const b = NAME_PARTS[20 + (index % 20)]!;
  const n = String(index + 1).padStart(2, '0');
  return `${a}${b}${n}`;
}

function jitter(value: number, rng: ReturnType<typeof createSeededRng>, pct = 0.12): number {
  const factor = 1 + rng.nextFloat(-pct, pct);
  return Math.max(0, Math.round(value * factor));
}

function buildProfile(index: number) {
  const rng = createSeededRng(index * 7919 + 42);
  const tier = index / (PLAYTEST_NPC_COUNT - 1);
  const targetNw = Math.round(2500 * Math.pow(120, tier));

  let cash = Math.max(300, Math.round(targetNw * 0.15));
  let prostitutes = Math.max(1, Math.round(1 + tier * 45));
  let thugs = Math.max(1, Math.round(1 + tier * 40));
  let rides = Math.max(0, Math.round(tier * 18));
  let hash = Math.max(0, Math.round(tier * 60));
  let shrooms = Math.max(0, Math.round(tier * 30));
  let coke = Math.max(0, Math.round(tier * 20));
  let heroin = Math.max(0, Math.round(tier * 12));
  const glocks = Math.max(1, Math.min(thugs, Math.round(1 + tier * 15)));
  const uzis = Math.max(0, Math.round(tier * 10));
  const aks = Math.max(0, Math.round(tier * 5));
  const beer = Math.max(3, Math.round(5 + tier * 60));
  const condoms = Math.max(5, Math.round(10 + tier * 80));
  const prostitutePayoutPercent = Math.max(15, Math.min(65, Math.round(60 - tier * 40)));

  const nw = () =>
    calculateNetWorth(
      playerToResources({
        cash,
        prostitutes,
        thugs,
        rides,
        hash,
        shrooms,
        coke,
        heroin,
      }),
    );

  let guard = 0;
  while (nw() < targetNw * 0.85 && guard < 12) {
    if (guard % 3 === 0) prostitutes += 1;
    else if (guard % 3 === 1) thugs += 1;
    else cash += Math.max(500, Math.round(targetNw * 0.05));
    guard++;
  }

  return {
    alias: playtestNpcAlias(index),
    districtSlug: DISTRICT_SLUGS[index % DISTRICT_SLUGS.length]!,
    cash,
    prostitutes,
    thugs,
    rides,
    glocks,
    uzis,
    aks,
    beer,
    condoms,
    hash,
    shrooms,
    coke,
    heroin,
    prostitutePayoutPercent,
    lastSeenHoursAgo: rng.nextFloat(0.25, 96),
  };
}

async function createRankSnapshots(
  prisma: PrismaClient,
  playerId: string,
  seasonId: string,
  netWorth: number,
  rng: ReturnType<typeof createSeededRng>,
) {
  const drift = Math.max(500, Math.round(netWorth * rng.nextFloat(0.03, 0.12)));
  await prisma.rankSnapshot.create({
    data: {
      playerId,
      seasonId,
      netWorth: Math.max(0, netWorth - drift),
      rank: 0,
      createdAt: new Date(Date.now() - rng.nextInt(2, 10) * 24 * 60 * 60 * 1000),
    },
  });
  await prisma.rankSnapshot.create({
    data: {
      playerId,
      seasonId,
      netWorth: Math.max(0, netWorth - Math.round(drift * 0.4)),
      rank: 0,
      createdAt: new Date(Date.now() - rng.nextInt(1, 3) * 24 * 60 * 60 * 1000),
    },
  });
  await prisma.rankSnapshot.create({
    data: { playerId, seasonId, netWorth, rank: 0 },
  });
}

export async function seedPlaytestNpcs(
  prisma: PrismaClient,
  options?: { jitterExisting?: boolean },
) {
  const jitterExisting = options?.jitterExisting ?? process.env.SEED_NPC_JITTER === 'true';

  const season = await prisma.season.findFirst({
    where: { status: SeasonStatus.ACTIVE },
    orderBy: { number: 'desc' },
  });
  if (!season) throw new Error('No active season — run db:seed first');

  const districts = await prisma.district.findMany();
  const districtMap = new Map(districts.map((d) => [d.slug, d]));

  let created = 0;
  let skipped = 0;
  let jittered = 0;

  for (let i = 0; i < PLAYTEST_NPC_COUNT; i++) {
    const profile = buildProfile(i);
    const aliasNorm = normalizeAlias(profile.alias);
    const existing = await prisma.player.findUnique({
      where: { aliasNormalized: aliasNorm },
      include: { user: true },
    });

    if (existing) {
      skipped++;
      const isPlaytestNpc = existing.user.email.startsWith(PLAYTEST_NPC_EMAIL_PREFIX);
      if (jitterExisting && isPlaytestNpc) {
        const rng = createSeededRng(Date.now() % 100000 + i * 313);
        const next = {
          cash: jitter(existing.cash, rng),
          prostitutes: jitter(existing.prostitutes, rng, 0.08),
          thugs: jitter(existing.thugs, rng, 0.08),
          rides: jitter(existing.rides, rng, 0.1),
          hash: jitter(existing.hash, rng, 0.15),
          shrooms: jitter(existing.shrooms, rng, 0.15),
          coke: jitter(existing.coke, rng, 0.15),
          heroin: jitter(existing.heroin, rng, 0.15),
          glocks: Math.max(1, jitter(existing.glocks, rng, 0.1)),
          uzis: jitter(existing.uzis, rng, 0.15),
          aks: jitter(existing.aks, rng, 0.15),
        };
        await prisma.player.update({
          where: { id: existing.id },
          data: next,
        });
        const nw = calculateNetWorth(playerToResources({ ...existing, ...next }));
        await prisma.rankSnapshot.create({
          data: {
            playerId: existing.id,
            seasonId: season.id,
            netWorth: nw,
            rank: 0,
          },
        });
        await prisma.playerStatusExt.upsert({
          where: { playerId: existing.id },
          create: { playerId: existing.id, lastSeenAt: new Date() },
          update: { lastSeenAt: new Date(Date.now() - profile.lastSeenHoursAgo * 60 * 60 * 1000) },
        });
        jittered++;
      }
      continue;
    }

    const district = districtMap.get(profile.districtSlug);
    if (!district) throw new Error(`District not found: ${profile.districtSlug}`);

    const email = `${PLAYTEST_NPC_EMAIL_PREFIX}${aliasNorm}@neonunderworld.local`;
    const user = await prisma.user.create({
      data: {
        email,
        passwordHash: await hashPassword(`playtest-npc-${aliasNorm}-not-for-login`),
        role: 'PLAYER',
      },
    });

    const prostituteHappiness = calculateProstituteHappiness({
      prostitutes: profile.prostitutes,
      thugs: profile.thugs,
      hash: profile.hash,
      condoms: profile.condoms,
      prostitutePayoutPercent: profile.prostitutePayoutPercent,
    }).score;

    const thugHappiness = calculateThugHappiness({
      thugs: profile.thugs,
      glocks: profile.glocks,
      uzis: profile.uzis,
      aks: profile.aks,
      beer: profile.beer,
    }).score;

    const player = await prisma.player.create({
      data: {
        userId: user.id,
        alias: profile.alias,
        aliasNormalized: aliasNorm,
        districtId: district.id,
        seasonId: season.id,
        cash: profile.cash,
        prostitutes: profile.prostitutes,
        thugs: profile.thugs,
        rides: profile.rides,
        glocks: profile.glocks,
        uzis: profile.uzis,
        aks: profile.aks,
        beer: profile.beer,
        condoms: profile.condoms,
        hash: profile.hash,
        shrooms: profile.shrooms,
        coke: profile.coke,
        heroin: profile.heroin,
        prostitutePayoutPercent: profile.prostitutePayoutPercent,
        prostituteHappiness,
        thugHappiness,
        isSystemPlayer: false,
        avatar: resolveNpcSeedAvatar(aliasNorm),
      },
    });

    const initialTurns = createInitialTurnState();
    await prisma.playerTurnState.create({
      data: {
        playerId: player.id,
        currentTurns: initialTurns.currentTurns,
        lastRegeneratedAt: initialTurns.lastRegeneratedAt,
        turnCap: TURNS_CONFIG.turnCap,
        regenerationRate: TURNS_CONFIG.regenerationRatePerMs,
      },
    });

    const lastSeenAt = new Date(Date.now() - profile.lastSeenHoursAgo * 60 * 60 * 1000);
    await prisma.playerStatusExt.upsert({
      where: { playerId: player.id },
      create: { playerId: player.id, lastSeenAt },
      update: { lastSeenAt },
    });

    const nw = calculateNetWorth(playerToResources(player));
    const rng = createSeededRng(i * 1337);
    await createRankSnapshots(prisma, player.id, season.id, nw, rng);

    created++;
    console.log(`  + ${profile.alias} (${district.name}) — NW $${nw.toLocaleString()}`);
  }

  console.log(
    `Playtest NPC seed complete: ${created} created, ${skipped} already existed${jittered ? `, ${jittered} jittered` : ''}.`,
  );
}

async function main() {
  const { assertDevSeedAllowed } = await import('./lib/dev-guard');
  assertDevSeedAllowed('seed-playtest-npcs');
  const { PrismaClient } = await import('@prisma/client');
  const prisma = new PrismaClient();
  try {
    console.log(`Seeding ${PLAYTEST_NPC_COUNT} playtest NPC opponents...`);
    await seedPlaytestNpcs(prisma);
  } finally {
    await prisma.$disconnect();
  }
}

const isDirectRun = process.argv[1]?.includes('seed-playtest-npcs');
if (isDirectRun) {
  main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
