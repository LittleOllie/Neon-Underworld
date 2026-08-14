/**
 * Seeds a canonical fresh-player account for E2E / local testing.
 * NOT for production — guarded by assertDevSeedAllowed.
 *
 * Usage: npm run db:seed:fresh-e2e
 */
import { PrismaClient, SeasonStatus } from '@prisma/client';
import { hashPassword, normalizeEmail, normalizeAlias } from '../src/lib/security/crypto';
import { STARTING_RESOURCES, TURNS_CONFIG } from '../src/config/game/balance';
import { createInitialTurnState } from '../src/lib/game-engine/turns';
import { calculateNetWorth } from '../src/lib/game-engine/net-worth';
import { playerToResources } from '../src/lib/game-engine/state';
import {
  calculateProstituteHappiness,
  calculateThugHappiness,
} from '../src/lib/game-engine/happiness';
import { assertDevSeedAllowed } from './lib/dev-guard';

const prisma = new PrismaClient();

export const FRESH_E2E_EMAIL = 'fresh-e2e+tester@neonunderworld.local';
export const FRESH_E2E_PASSWORD = 'fresh-e2e-not-for-production';
export const FRESH_E2E_ALIAS = 'FreshE2E';

async function main() {
  assertDevSeedAllowed('seed-fresh-e2e-player');

  const district = await prisma.district.findFirst({ where: { slug: 'neon-strip', active: true } });
  const season = await prisma.season.findFirst({ where: { status: SeasonStatus.ACTIVE } });
  if (!district || !season) throw new Error('Run db:seed first (district + season required)');

  const email = normalizeEmail(FRESH_E2E_EMAIL);
  const aliasNormalized = normalizeAlias(FRESH_E2E_ALIAS);
  const passwordHash = await hashPassword(FRESH_E2E_PASSWORD);
  const turns = createInitialTurnState();

  const existing = await prisma.user.findUnique({
    where: { email },
    include: { player: { include: { turnState: true } } },
  });

  if (existing?.player) {
    await prisma.player.update({
      where: { id: existing.player.id },
      data: {
        cash: STARTING_RESOURCES.cash,
        bankCash: 0,
        prostitutes: STARTING_RESOURCES.prostitutes,
        thugs: STARTING_RESOURCES.thugs,
        glocks: STARTING_RESOURCES.glocks,
        uzis: 0,
        aks: 0,
        rides: 0,
        beer: STARTING_RESOURCES.beer,
        condoms: STARTING_RESOURCES.condoms,
        hash: STARTING_RESOURCES.hash,
        shrooms: 0,
        coke: 0,
        heroin: 0,
        prostitutePayoutPercent: STARTING_RESOURCES.prostitutePayoutPercent,
        cartelId: null,
        travelling: false,
        travelDestination: null,
        lifeStatus: 'ACTIVE',
        health: 100,
        avatar: 'viper',
      },
    });
    await prisma.playerTurnState.upsert({
      where: { playerId: existing.player.id },
      create: {
        playerId: existing.player.id,
        currentTurns: turns.currentTurns,
        turnCap: turns.turnCap,
        lastRegeneratedAt: turns.lastRegeneratedAt,
        regenerationRate: TURNS_CONFIG.regenerationRatePerMs,
      },
      update: {
        currentTurns: turns.currentTurns,
        turnCap: turns.turnCap,
        lastRegeneratedAt: turns.lastRegeneratedAt,
        regenerationRate: TURNS_CONFIG.regenerationRatePerMs,
      },
    });
    await prisma.report.deleteMany({ where: { playerId: existing.player.id } });
    await prisma.marketBid.deleteMany({ where: { bidderId: existing.player.id } });
    await prisma.marketListing.deleteMany({ where: { sellerId: existing.player.id } });
    console.log(JSON.stringify({ reset: true, alias: FRESH_E2E_ALIAS, email: FRESH_E2E_EMAIL }));
    return;
  }

  const pHappy = calculateProstituteHappiness({
    prostitutes: STARTING_RESOURCES.prostitutes,
    thugs: STARTING_RESOURCES.thugs,
    hash: STARTING_RESOURCES.hash,
    condoms: STARTING_RESOURCES.condoms,
    prostitutePayoutPercent: STARTING_RESOURCES.prostitutePayoutPercent,
  }).score;
  const tHappy = calculateThugHappiness({
    thugs: STARTING_RESOURCES.thugs,
    glocks: STARTING_RESOURCES.glocks,
    uzis: 0,
    aks: 0,
    beer: STARTING_RESOURCES.beer,
  }).score;
  const nw = calculateNetWorth(
    playerToResources({ ...STARTING_RESOURCES, cash: STARTING_RESOURCES.cash, businesses: 0 }),
  );
  void nw;

  const user = await prisma.user.create({
    data: {
      email,
      passwordHash,
      role: 'PLAYER',
      player: {
        create: {
          alias: FRESH_E2E_ALIAS,
          aliasNormalized,
          districtId: district.id,
          seasonId: season.id,
          cash: STARTING_RESOURCES.cash,
          bankCash: 0,
          prostitutes: STARTING_RESOURCES.prostitutes,
          thugs: STARTING_RESOURCES.thugs,
          glocks: STARTING_RESOURCES.glocks,
          uzis: 0,
          aks: 0,
          rides: 0,
          beer: STARTING_RESOURCES.beer,
          condoms: STARTING_RESOURCES.condoms,
          hash: STARTING_RESOURCES.hash,
          shrooms: 0,
          coke: 0,
          heroin: 0,
          prostitutePayoutPercent: STARTING_RESOURCES.prostitutePayoutPercent,
          prostituteHappiness: pHappy,
          thugHappiness: tHappy,
          lifeStatus: 'ACTIVE',
          health: 100,
          avatar: 'viper',
          turnState: {
            create: {
              currentTurns: turns.currentTurns,
              turnCap: turns.turnCap,
              lastRegeneratedAt: turns.lastRegeneratedAt,
              regenerationRate: TURNS_CONFIG.regenerationRatePerMs,
            },
          },
        },
      },
    },
    include: { player: true },
  });

  console.log(
    JSON.stringify({
      created: true,
      alias: user.player?.alias,
      email: FRESH_E2E_EMAIL,
      turns: turns.currentTurns,
      cash: STARTING_RESOURCES.cash,
    }),
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
