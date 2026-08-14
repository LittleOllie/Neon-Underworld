/**
 * Prepares deterministic combat E2E scenario for admin vs first system player.
 * Run before attack-v1 E2E: npx tsx scripts/e2e-combat-setup.ts
 */
import { PrismaClient } from '@prisma/client';
import { ATTACK_RULES } from '../src/config/game/attack-rules';
import { buildPlayerIntelSnapshot } from '../src/lib/game-engine/combat/build-intel-snapshot';
import { calculateCanonicalNetWorth } from '../NeonUnderworld-OldSkool/src/config/valuations';
import { assertDevSeedAllowed } from './lib/dev-guard';

const prisma = new PrismaClient();

async function main() {
  assertDevSeedAllowed('e2e-combat-setup');
  const adminEmail = process.env.SEED_ADMIN_EMAIL ?? 'admin@neonunderworld.local';
  const admin = await prisma.user.findUnique({
    where: { email: adminEmail.toLowerCase() },
    include: { player: { include: { turnState: true, district: true, season: true } } },
  });
  if (!admin?.player) throw new Error('Admin player not found — run db:seed first');

  const defender = await prisma.player.findFirst({
    where: {
      seasonId: admin.player.seasonId,
      districtId: admin.player.districtId,
      isSystemPlayer: false,
      id: { not: admin.player.id },
    },
    include: { district: true },
    orderBy: { createdAt: 'asc' },
  });
  if (!defender) throw new Error('No attackable non-system defender found in admin district');

  await prisma.player.update({
    where: { id: admin.player.id },
    data: {
      thugs: 250,
      rides: 60,
      glocks: 50,
      uzis: 30,
      aks: 20,
      cash: 500_000,
    },
  });

  if (admin.player.turnState) {
    await prisma.playerTurnState.update({
      where: { playerId: admin.player.id },
      data: { currentTurns: 500 },
    });
  }

  await prisma.player.update({
    where: { id: defender.id },
    data: {
      thugs: 80,
      glocks: 20,
      uzis: 10,
      aks: 5,
      cash: 120_000,
      bankCash: 500_000,
      hash: 50,
      shrooms: 30,
      coke: 20,
      heroin: 10,
    },
  });

  const defenderNw = calculateCanonicalNetWorth({
    cash: 120_000,
    bankCash: 500_000,
    thugs: 80,
    workers: defender.prostitutes,
    vehicles: defender.rides,
    drugs: 50 + 30 + 20 + 10,
  });

  const intel = buildPlayerIntelSnapshot(
    {
      id: defender.id,
      alias: defender.alias,
      districtName: defender.district.name,
      thugs: 80,
      glocks: 20,
      uzis: 10,
      aks: 5,
      cash: 120_000,
      hash: 50,
      shrooms: 30,
      coke: 20,
      heroin: 10,
      cartelId: defender.cartelId,
      canonicalNetWorth: defenderNw,
    },
    424242,
  );

  await prisma.report.deleteMany({
    where: {
      playerId: admin.player.id,
      metadata: { path: ['type'], equals: 'PLAYER_INTEL' },
    },
  });

  await prisma.combatEncounter.deleteMany({
    where: {
      attackerId: admin.player.id,
      defenderId: defender.id,
    },
  });

  await prisma.playerStatusExt.upsert({
    where: { playerId: defender.id },
    create: {
      playerId: defender.id,
      offlineDamagingHits: 0,
      offlineProtectionActive: false,
      lastSeenAt: new Date(),
    },
    update: {
      offlineDamagingHits: 0,
      offlineProtectionActive: false,
      lastSeenAt: new Date(),
    },
  });

  await prisma.report.create({
    data: {
      playerId: admin.player.id,
      category: 'SCOUT',
      title: `Player Intel — ${defender.alias}`,
      summary: `E2E combat intel · ${intel.confidencePercent}% confidence`,
      metadata: {
        type: 'PLAYER_INTEL',
        intel,
        idempotencyKey: 'e2e-combat-intel',
      } as object,
    },
  });

  console.log(`Combat E2E ready: ${admin.player.alias} → ${defender.alias}`);
  console.log(`Scout intel cost: ${ATTACK_RULES.scoutIntelTurnCost} turns (pre-seeded report)`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
