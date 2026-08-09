import { PrismaClient, SeasonStatus } from '@prisma/client';
import {
  hashPassword,
  hashInviteCode,
  normalizeEmail,
  normalizeAlias,
} from '../src/lib/security/crypto';
import {
  DISTRICTS,
  STARTING_RESOURCES,
  TURNS_CONFIG,
} from '../src/config/game/balance';
import { createInitialTurnState } from '../src/lib/game-engine/turns';
import { calculateNetWorth } from '../src/lib/game-engine/net-worth';
import { playerToResources } from '../src/lib/game-engine/state';
import {
  calculateProstituteHappiness,
  calculateThugHappiness,
} from '../src/lib/game-engine/happiness';
import { createSeededRng } from '../src/lib/game-engine/rng';
import { resolveScouting } from '../src/lib/game-engine/scouting';
import type { DistrictModifiers } from '../src/config/game/balance';

const prisma = new PrismaClient();

const SYSTEM_ALIASES = [
  'Vex_Morgan', 'SilkRunner', 'IronVeil', 'NightLedger', 'CrimsonWard',
  'AshProtocol', 'VelvetCircuit', 'DocksideKing', 'NeonRegent', 'CipherBoss',
  'BlackTide', 'GildedFang', 'MurkyCrown', 'PulseSyndicate', 'ObsidianDuke',
  'RookStreet', 'HazeCollector', 'CopperSignal', 'VaultSerpent', 'GridPhantom',
  'LowlightBaron', 'SteelWhisper', 'HarborGhost', 'StripConsul', 'OldCoin',
  'WireSaint', 'DuskBroker', 'FleetCaptain', 'MirrorHeir', 'QuietEmpire',
  'NeonArchivist', 'CanalWarden', 'GraftLine', 'SilverRacket', 'Underboss_7',
  'LanternCourt', 'PortAuthority', 'VelvetHammer', 'CipherLane', 'NightAudit',
  'BrassSyndicate', 'DocksideHeir', 'StripMonarch', 'QuarterMaster', 'GridBaron',
];

function randomInt(rng: ReturnType<typeof createSeededRng>, min: number, max: number) {
  return rng.nextInt(min, max);
}

async function main() {
  console.log('Seeding Neon Underworld...');

  const adminEmail = process.env.SEED_ADMIN_EMAIL ?? 'admin@neonunderworld.local';
  const adminPassword = process.env.SEED_ADMIN_PASSWORD ?? 'AdminChangeMe123!';
  const inviteCode = process.env.SEED_INVITE_CODE ?? 'NEON-ALPHA-2026';

  for (const d of DISTRICTS) {
    await prisma.district.upsert({
      where: { slug: d.slug },
      update: { name: d.name, description: d.description, modifiers: d.modifiers as object, active: true },
      create: { slug: d.slug, name: d.name, description: d.description, modifiers: d.modifiers as object, active: true },
    });
  }

  const districts = await prisma.district.findMany();
  const districtMap = new Map(districts.map((d) => [d.slug, d]));

  const seasonStart = new Date();
  const SEASON_DAYS = 30;
  const seasonEnd = new Date(seasonStart.getTime() + SEASON_DAYS * 24 * 60 * 60 * 1000);

  const season = await prisma.season.upsert({
    where: { number: 1 },
    update: {
      status: SeasonStatus.ACTIVE,
      startsAt: seasonStart,
      endsAt: seasonEnd,
      name: 'Season I — Neon Ascendant',
    },
    create: {
      number: 1,
      name: 'Season I — Neon Ascendant',
      status: SeasonStatus.ACTIVE,
      startsAt: seasonStart,
      endsAt: seasonEnd,
    },
  });

  const inviteHash = await hashInviteCode(inviteCode);
  const existingInvite = await prisma.inviteCode.findFirst({ where: { label: 'Alpha Access' } });
  if (!existingInvite) {
    await prisma.inviteCode.create({
      data: {
        codeHash: inviteHash,
        label: 'Alpha Access',
        active: true,
        maximumUses: 100,
        currentUses: 0,
      },
    });
  }

  const adminHash = await hashPassword(adminPassword);
  await prisma.user.upsert({
    where: { email: normalizeEmail(adminEmail) },
    update: { passwordHash: adminHash, role: 'ADMIN' },
    create: {
      email: normalizeEmail(adminEmail),
      passwordHash: adminHash,
      role: 'ADMIN',
    },
  });

  const adminWithPlayer = await prisma.user.findUnique({
    where: { email: normalizeEmail(adminEmail) },
    include: { player: true },
  });

  if (adminWithPlayer && !adminWithPlayer.player) {
    const district = districtMap.get('neon-strip')!;
    const alias = 'HermaNFT';
    const prostituteHappiness = calculateProstituteHappiness({
      prostitutes: STARTING_RESOURCES.prostitutes,
      thugs: STARTING_RESOURCES.thugs,
      hash: STARTING_RESOURCES.hash,
      condoms: STARTING_RESOURCES.condoms,
      prostitutePayoutPercent: STARTING_RESOURCES.prostitutePayoutPercent,
    }).score;
    const thugHappiness = calculateThugHappiness({
      thugs: STARTING_RESOURCES.thugs,
      glocks: STARTING_RESOURCES.glocks,
      uzis: STARTING_RESOURCES.uzis,
      aks: STARTING_RESOURCES.aks,
      beer: STARTING_RESOURCES.beer,
    }).score;

    const player = await prisma.player.create({
      data: {
        userId: adminWithPlayer.id,
        alias,
        aliasNormalized: normalizeAlias(alias),
        districtId: district.id,
        seasonId: season.id,
        cash: STARTING_RESOURCES.cash,
        prostitutes: STARTING_RESOURCES.prostitutes,
        thugs: STARTING_RESOURCES.thugs,
        rides: STARTING_RESOURCES.rides,
        glocks: STARTING_RESOURCES.glocks,
        uzis: STARTING_RESOURCES.uzis,
        aks: STARTING_RESOURCES.aks,
        beer: STARTING_RESOURCES.beer,
        condoms: STARTING_RESOURCES.condoms,
        hash: STARTING_RESOURCES.hash,
        shrooms: STARTING_RESOURCES.shrooms,
        coke: STARTING_RESOURCES.coke,
        heroin: STARTING_RESOURCES.heroin,
        prostitutePayoutPercent: STARTING_RESOURCES.prostitutePayoutPercent,
        prostituteHappiness,
        thugHappiness,
        isSystemPlayer: false,
      },
    });

    const initialTurns = createInitialTurnState();
    await prisma.playerTurnState.create({
      data: {
        playerId: player.id,
        currentTurns: initialTurns.currentTurns,
        lastRegeneratedAt: initialTurns.lastRegeneratedAt,
        turnCap: initialTurns.turnCap,
        regenerationRate: initialTurns.regenerationRatePerMs,
      },
    });
  }

  for (let i = 0; i < SYSTEM_ALIASES.length; i++) {
    const alias = SYSTEM_ALIASES[i]!;
    const aliasNorm = normalizeAlias(alias);
    const existing = await prisma.player.findUnique({ where: { aliasNormalized: aliasNorm } });
    if (existing) continue;

    const districtSlugs = ['neon-strip', 'docklands', 'old-quarter'];
    const district = districtMap.get(districtSlugs[i % 3]!)!;
    const rng = createSeededRng(i * 7919);

    const prostitutes = randomInt(rng, 5, 80);
    const thugs = randomInt(rng, 3, 50);
    const cash = randomInt(rng, 5000, 150000);
    const rides = randomInt(rng, 0, 10);
    const hash = randomInt(rng, 0, 100);
    const glocks = randomInt(rng, 1, thugs);
    const beer = randomInt(rng, 5, 50);

    const email = `system+${aliasNorm}@neonunderworld.local`;
    const user = await prisma.user.create({
      data: {
        email,
        passwordHash: await hashPassword(`system-${aliasNorm}-not-for-login`),
        role: 'PLAYER',
      },
    });

    const prostituteHappiness = calculateProstituteHappiness({
      prostitutes, thugs, hash, condoms: randomInt(rng, 10, 100),
      prostitutePayoutPercent: randomInt(rng, 40, 60),
    }).score;

    const thugHappiness = calculateThugHappiness({
      thugs, glocks, uzis: randomInt(rng, 0, 5), aks: randomInt(rng, 0, 3), beer,
    }).score;

    const player = await prisma.player.create({
      data: {
        userId: user.id,
        alias,
        aliasNormalized: aliasNorm,
        districtId: district.id,
        seasonId: season.id,
        cash,
        prostitutes,
        thugs,
        rides,
        glocks,
        uzis: randomInt(rng, 0, 5),
        aks: randomInt(rng, 0, 3),
        beer,
        condoms: randomInt(rng, 10, 100),
        hash,
        shrooms: randomInt(rng, 0, 50),
        coke: randomInt(rng, 0, 30),
        heroin: randomInt(rng, 0, 20),
        prostitutePayoutPercent: randomInt(rng, 40, 60),
        prostituteHappiness,
        thugHappiness,
        isSystemPlayer: true,
      },
    });

    const initialTurns = createInitialTurnState();
    await prisma.playerTurnState.create({
      data: {
        playerId: player.id,
        currentTurns: randomInt(rng, 200, 3000),
        lastRegeneratedAt: new Date(Date.now() - randomInt(rng, 0, 12) * 60 * 60 * 1000),
        turnCap: TURNS_CONFIG.turnCap,
        regenerationRate: TURNS_CONFIG.regenerationRatePerMs,
      },
    });

    const nw = calculateNetWorth(playerToResources({ ...player, cash, prostitutes, thugs, rides, hash, shrooms: player.shrooms, coke: player.coke, heroin: player.heroin }));
    await prisma.rankSnapshot.create({
      data: {
        playerId: player.id,
        seasonId: season.id,
        netWorth: nw - randomInt(rng, 500, 5000),
        rank: 0,
        createdAt: new Date(Date.now() - randomInt(rng, 1, 7) * 24 * 60 * 60 * 1000),
      },
    });
    await prisma.rankSnapshot.create({
      data: { playerId: player.id, seasonId: season.id, netWorth: nw, rank: 0 },
    });

    if (i < 10) {
      const modifiers = district.modifiers as unknown as DistrictModifiers;
      const scoutSeed = createSeededRng(i * 1337);
      const turnsSpent = randomInt(scoutSeed, 25, 200);
      const outcome = resolveScouting({
        turnsSpent,
        districtModifiers: modifiers,
        prostituteHappiness,
        thugHappiness,
        prostituteCount: prostitutes,
        thugCount: thugs,
        prostitutePayoutPercent: player.prostitutePayoutPercent,
        seed: i * 1337,
      });

      await prisma.scoutResult.create({
        data: {
          playerId: player.id,
          districtId: district.id,
          turnsSpent,
          prostitutesFound: outcome.prostitutesFound,
          thugsFound: outcome.thugsFound,
          cashEarned: outcome.cashEarned,
          prostitutesLost: outcome.prostitutesLost,
          thugsLost: outcome.thugsLost,
        },
      });
    }
  }

  console.log('Seed complete.');
  console.log(`Admin: ${adminEmail}`);
  console.log(`Invite code: ${inviteCode}`);

  const { seedPlaytestNpcs } = await import('../scripts/seed-playtest-npcs');
  console.log('Seeding playtest NPC opponents...');
  await seedPlaytestNpcs(prisma);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
