#!/usr/bin/env npx tsx
/**
 * NPC playtest smoke — live attack + progression recovery on dev DB.
 * Run: npx tsx scripts/npc-playtest-smoke.ts
 */
import { PrismaClient } from '@prisma/client';
import { v4 as uuidv4 } from 'uuid';
import { resolveAttackEncounter } from '../src/server/services/combat.service';
import { buildPlayerIntelSnapshot } from '../src/lib/game-engine/combat/build-intel-snapshot';
import { calculateCanonicalNetWorthFromPlayer } from '../src/lib/game-engine/canonical-net-worth';
import { aggregateBusinessNwContext } from '../src/server/services/business.service';
import { progressNpcPlayer } from '../src/server/services/npc-progression.service';
import {
  applyNpcTargetStateToPlayer,
  progressionMetaForDevPvp,
} from '../src/lib/game-engine/npc-progression/initialize';
import { minAttackTargetNetWorth } from '../src/config/game/redlite-rules';
import { assertDevSeedAllowed } from './lib/dev-guard';

const prisma = new PrismaClient();

async function playerSnapshot(playerId: string) {
  const p = await prisma.player.findUniqueOrThrow({
    where: { id: playerId },
    include: { ownedBusinesses: true, district: true, user: true, npcProgression: true },
  });
  const biz = aggregateBusinessNwContext(p.ownedBusinesses);
  const nw = calculateCanonicalNetWorthFromPlayer(p, biz);
  const drugs = p.hash + p.shrooms + p.coke + p.heroin;
  return {
    alias: p.alias,
    nw,
    cash: p.cash,
    workers: p.prostitutes + biz.assignedWorkers,
    thugs: p.thugs + biz.assignedSecurityThugs,
    drugs,
    progressionDay: p.npcProgression?.lastProgressedDay ?? null,
    district: p.district.slug,
  };
}

async function main() {
  assertDevSeedAllowed('npc-playtest-smoke');

  const adminEmail = (process.env.SEED_ADMIN_EMAIL ?? 'admin@neonunderworld.local').toLowerCase();
  const admin = await prisma.user.findUnique({
    where: { email: adminEmail },
    include: { player: { include: { turnState: true, district: true, season: true } } },
  });
  if (!admin?.player) throw new Error('Admin not found — run db:seed');

  let defender = await prisma.player.findFirst({
    where: {
      seasonId: admin.player.seasonId,
      districtId: admin.player.districtId,
      user: { email: { startsWith: 'dev-pvp+' } },
    },
    include: { user: true, district: true, ownedBusinesses: true },
    orderBy: { thugs: 'desc' },
  });
  if (!defender) throw new Error('No dev-pvp opponent in admin district — run db:seed:dev-pvp');

  const devPvpIndex = ['neonviper', 'rustrunner', 'dockrat', 'quarterghost', 'harborking', 'stripregent', 'coinbroker', 'gridphantom42', 'velvetstrike', 'nightauditor']
    .indexOf(defender.aliasNormalized.toLowerCase());
  const devMeta = progressionMetaForDevPvp(Math.max(0, devPvpIndex), defender.aliasNormalized);
  await applyNpcTargetStateToPlayer(prisma, {
    playerId: defender.id,
    districtId: defender.districtId,
    seasonId: admin.player.seasonId,
    archetype: devMeta.archetype,
    ladderSlot: devMeta.ladderSlot,
    growthSeed: devMeta.growthSeed,
    roundDay: 1,
  });
  defender = await prisma.player.findUniqueOrThrow({
    where: { id: defender.id },
    include: { user: true, district: true, ownedBusinesses: true },
  });

  const adminBiz = aggregateBusinessNwContext(
    await prisma.business.findMany({ where: { playerId: admin.player!.id } }),
  );
  const adminNw = calculateCanonicalNetWorthFromPlayer(admin.player!, adminBiz);
  const minTarget = minAttackTargetNetWorth(adminNw);

  let defBiz = aggregateBusinessNwContext(defender.ownedBusinesses);
  let defenderNw = calculateCanonicalNetWorthFromPlayer(defender, defBiz);
  if (defenderNw < minTarget) {
    await prisma.player.update({
      where: { id: defender.id },
      data: {
        cash: Math.max(defender.cash, minTarget),
        thugs: Math.max(defender.thugs, 80),
        glocks: Math.max(defender.glocks, 20),
        bankCash: Math.max(defender.bankCash, Math.floor(minTarget * 0.5)),
      },
    });
    defender = await prisma.player.findUniqueOrThrow({
      where: { id: defender.id },
      include: { user: true, district: true, ownedBusinesses: true },
    });
    defBiz = aggregateBusinessNwContext(defender.ownedBusinesses);
    defenderNw = calculateCanonicalNetWorthFromPlayer(defender, defBiz);
  }

  console.log('SETUP', { adminNw, minTarget, defenderNw, defender: defender.alias });

  await prisma.player.update({
    where: { id: admin.player.id },
    data: { thugs: 200, rides: 50, glocks: 40, uzis: 20, aks: 10, cash: 500_000 },
  });
  if (admin.player.turnState) {
    await prisma.playerTurnState.update({
      where: { playerId: admin.player.id },
      data: { currentTurns: 500 },
    });
  }

  const before = await playerSnapshot(defender.id);
  console.log('BEFORE ATTACK', JSON.stringify(before, null, 2));

  const intel = buildPlayerIntelSnapshot(
    {
      id: defender.id,
      alias: defender.alias,
      districtName: defender.district.name,
      thugs: defender.thugs,
      glocks: defender.glocks,
      uzis: defender.uzis,
      aks: defender.aks,
      cash: defender.cash,
      hash: defender.hash,
      shrooms: defender.shrooms,
      coke: defender.coke,
      heroin: defender.heroin,
      cartelId: defender.cartelId,
      canonicalNetWorth: defenderNw,
    },
    777001,
  );

  const report = await prisma.report.create({
    data: {
      playerId: admin.player.id,
      category: 'SCOUT',
      title: `Intel: ${defender.alias}`,
      summary: 'Smoke test intel',
      metadata: { type: 'PLAYER_INTEL', intel } as object,
    },
  });

  const attackKey = `smoke-${uuidv4()}`;
  const result = await resolveAttackEncounter(
    admin.player.id,
    admin.id,
    { kind: 'intel', scoutReportId: report.id },
    'HOME_INVASION',
    80,
    attackKey,
  );

  console.log('ATTACK RESULT', {
    outcome: result.outcome,
    attackerLosses: result.attackerLosses,
    defenderLosses: result.defenderLosses,
    cashStolen: result.cashStolen,
    drugsStolen: result.drugsStolen,
    workersStolen: result.workersStolen,
  });

  const afterAttack = await playerSnapshot(defender.id);
  console.log('AFTER ATTACK', JSON.stringify(afterAttack, null, 2));

  const npcDay = afterAttack.progressionDay ?? 1;
  await progressNpcPlayer(prisma, {
    playerId: defender.id,
    email: defender.user.email,
    aliasNormalized: defender.aliasNormalized,
    districtId: defender.districtId,
    roundDay: npcDay + 1,
    force: false,
  });

  const afterProgression = await playerSnapshot(defender.id);
  console.log('AFTER PROGRESSION (once)', JSON.stringify(afterProgression, null, 2));

  await progressNpcPlayer(prisma, {
    playerId: defender.id,
    email: defender.user.email,
    aliasNormalized: defender.aliasNormalized,
    districtId: defender.districtId,
    roundDay: npcDay + 2,
    force: false,
  });

  const afterDay2 = await playerSnapshot(defender.id);
  console.log('AFTER PROGRESSION (simulated day+1)', JSON.stringify(afterDay2, null, 2));

  // District coverage
  for (const day of [1, 7]) {
    const districts = await prisma.district.findMany();
    const counts: Record<string, number> = {};
    for (const d of districts) {
      counts[d.slug] = await prisma.player.count({
        where: {
          districtId: d.id,
          seasonId: admin.player.seasonId,
          isSystemPlayer: false,
          OR: [
            { user: { email: { startsWith: 'playtest-npc+' } } },
            { user: { email: { startsWith: 'dev-pvp+' } } },
          ],
        },
      });
    }
    console.log(`DISTRICT COVERAGE (current DB, reference day ${day} sim uses ladder)`, counts);
  }

  // Day-7 target coverage (same district as admin)
  const day7Npcs = await prisma.player.findMany({
    where: {
      seasonId: admin.player.seasonId,
      districtId: admin.player.districtId,
      isSystemPlayer: false,
      OR: [
        { user: { email: { startsWith: 'playtest-npc+' } } },
        { user: { email: { startsWith: 'dev-pvp+' } } },
      ],
    },
    include: { ownedBusinesses: true },
  });
  const humanLevels = [250_000, 500_000, 1_000_000, 2_500_000, 5_000_000, 8_000_000];
  console.log('DAY-7 TARGET COVERAGE (same district, current NW — run npc:progress --day 7 for true day-7):');
  for (const humanNw of humanLevels) {
    const minTarget = minAttackTargetNetWorth(humanNw);
    let eligible = 0;
    for (const npc of day7Npcs) {
      const biz = aggregateBusinessNwContext(npc.ownedBusinesses);
      const nw = calculateCanonicalNetWorthFromPlayer(npc, biz);
      if (nw >= minTarget) eligible++;
    }
    console.log(`  human $${humanNw.toLocaleString()} → ${eligible} eligible (min target $${minTarget.toLocaleString()})`);
  }

  console.log('SMOKE COMPLETE');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
