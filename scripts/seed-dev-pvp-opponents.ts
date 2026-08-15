/**
 * Seeds real development PvP opponents (isSystemPlayer: false) for local playtesting.
 * NOT run by default — invoke explicitly:
 *
 *   npm run db:seed:dev-pvp
 *
 * Safe for local/dev only. Does not run in production deploy pipelines unless called.
 */
import { PrismaClient, SeasonStatus } from '@prisma/client';
import {
  hashPassword,
  normalizeAlias,
} from '../src/lib/security/crypto';
import { TURNS_CONFIG, STARTING_RESOURCES } from '../src/config/game/balance';
import { createInitialTurnState } from '../src/lib/game-engine/turns';
import { calculateNetWorth } from '../src/lib/game-engine/net-worth';
import { playerToResources } from '../src/lib/game-engine/state';
import {
  calculateProstituteHappiness,
  calculateThugHappiness,
} from '../src/lib/game-engine/happiness';
import { resolveNpcSeedAvatar } from '../src/lib/game-engine/npc-avatar';

const prisma = new PrismaClient();

/** ~8–12 opponents with varied NW for attack-range testing (0.5×–2× of typical admin NW). */
const DEV_PVP_OPPONENTS = [
  {
    alias: 'RustRunner',
    districtSlug: 'neon-strip',
    cash: 500,
    prostitutes: 1,
    thugs: 1,
    rides: 0,
    glocks: 1,
    uzis: 0,
    aks: 0,
    beer: 3,
    condoms: 5,
    hash: 2,
    shrooms: 0,
    coke: 0,
    heroin: 0,
    prostitutePayoutPercent: 60,
    lastSeenHoursAgo: 48,
  },
  {
    alias: 'DockRat',
    districtSlug: 'docklands',
    cash: 1200,
    prostitutes: 2,
    thugs: 4,
    rides: 1,
    glocks: 3,
    uzis: 0,
    aks: 0,
    beer: 8,
    condoms: 10,
    hash: 5,
    shrooms: 2,
    coke: 0,
    heroin: 0,
    prostitutePayoutPercent: 55,
    lastSeenHoursAgo: 6,
  },
  {
    alias: 'QuarterGhost',
    districtSlug: 'old-quarter',
    cash: 2500,
    prostitutes: 3,
    thugs: 3,
    rides: 1,
    glocks: 2,
    uzis: 1,
    aks: 0,
    beer: 10,
    condoms: 15,
    hash: 8,
    shrooms: 4,
    coke: 2,
    heroin: 0,
    prostitutePayoutPercent: 50,
    lastSeenHoursAgo: 2,
  },
  {
    alias: 'NeonViper',
    districtSlug: 'neon-strip',
    cash: 8000,
    prostitutes: 8,
    thugs: 6,
    rides: 3,
    glocks: 5,
    uzis: 2,
    aks: 1,
    beer: 20,
    condoms: 30,
    hash: 15,
    shrooms: 8,
    coke: 5,
    heroin: 2,
    prostitutePayoutPercent: 45,
    lastSeenHoursAgo: 1,
  },
  {
    alias: 'HarborKing',
    districtSlug: 'docklands',
    cash: 12000,
    prostitutes: 5,
    thugs: 15,
    rides: 5,
    glocks: 10,
    uzis: 5,
    aks: 2,
    beer: 30,
    condoms: 20,
    hash: 10,
    shrooms: 5,
    coke: 8,
    heroin: 3,
    prostitutePayoutPercent: 40,
    lastSeenHoursAgo: 0.5,
  },
  {
    alias: 'StripRegent',
    districtSlug: 'neon-strip',
    cash: 18000,
    prostitutes: 20,
    thugs: 8,
    rides: 6,
    glocks: 8,
    uzis: 4,
    aks: 1,
    beer: 25,
    condoms: 50,
    hash: 25,
    shrooms: 12,
    coke: 10,
    heroin: 5,
    prostitutePayoutPercent: 35,
    lastSeenHoursAgo: 12,
  },
  {
    alias: 'CoinBroker',
    districtSlug: 'old-quarter',
    cash: 25000,
    prostitutes: 12,
    thugs: 12,
    rides: 8,
    glocks: 12,
    uzis: 6,
    aks: 3,
    beer: 40,
    condoms: 40,
    hash: 30,
    shrooms: 15,
    coke: 12,
    heroin: 6,
    prostitutePayoutPercent: 30,
    lastSeenHoursAgo: 24,
  },
  {
    alias: 'GridPhantom42',
    districtSlug: 'docklands',
    cash: 45000,
    prostitutes: 10,
    thugs: 25,
    rides: 12,
    glocks: 20,
    uzis: 10,
    aks: 5,
    beer: 50,
    condoms: 35,
    hash: 20,
    shrooms: 10,
    coke: 15,
    heroin: 8,
    prostitutePayoutPercent: 25,
    lastSeenHoursAgo: 72,
  },
  {
    alias: 'VelvetStrike',
    districtSlug: 'neon-strip',
    cash: 60000,
    prostitutes: 35,
    thugs: 18,
    rides: 15,
    glocks: 18,
    uzis: 12,
    aks: 6,
    beer: 60,
    condoms: 80,
    hash: 40,
    shrooms: 20,
    coke: 18,
    heroin: 10,
    prostitutePayoutPercent: 20,
    lastSeenHoursAgo: 4,
  },
  {
    alias: 'NightAuditor',
    districtSlug: 'old-quarter',
    cash: 90000,
    prostitutes: 25,
    thugs: 30,
    rides: 20,
    glocks: 25,
    uzis: 15,
    aks: 8,
    beer: 70,
    condoms: 60,
    hash: 50,
    shrooms: 25,
    coke: 20,
    heroin: 12,
    prostitutePayoutPercent: 15,
    lastSeenHoursAgo: 8,
  },
] as const;

async function main() {
  if (process.env.NODE_ENV === 'production' && process.env.ALLOW_DEV_PVP_SEED !== 'true') {
    console.error(
      'Refusing to seed dev PvP opponents in production. Set ALLOW_DEV_PVP_SEED=true to override.',
    );
    process.exit(1);
  }

  console.log('Seeding development PvP opponents...');

  const season = await prisma.season.findFirst({
    where: { status: SeasonStatus.ACTIVE },
    orderBy: { number: 'desc' },
  });
  if (!season) throw new Error('No active season — run db:seed first');

  const districts = await prisma.district.findMany();
  const districtMap = new Map(districts.map((d) => [d.slug, d]));

  let created = 0;
  let skipped = 0;

  for (const profile of DEV_PVP_OPPONENTS) {
    const aliasNorm = normalizeAlias(profile.alias);
    const existing = await prisma.player.findUnique({ where: { aliasNormalized: aliasNorm } });
    if (existing) {
      skipped++;
      continue;
    }

    const district = districtMap.get(profile.districtSlug);
    if (!district) throw new Error(`District not found: ${profile.districtSlug}`);

    const email = `dev-pvp+${aliasNorm}@neonunderworld.local`;
    const user = await prisma.user.create({
      data: {
        email,
        passwordHash: await hashPassword(`dev-pvp-${aliasNorm}-not-for-login`),
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
    await prisma.rankSnapshot.create({
      data: {
        playerId: player.id,
        seasonId: season.id,
        netWorth: nw,
        rank: 0,
      },
    });

    created++;
    console.log(`  + ${profile.alias} (${district.name}) — NW $${nw.toLocaleString()}`);
  }

  console.log(`Dev PvP seed complete: ${created} created, ${skipped} already existed.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
