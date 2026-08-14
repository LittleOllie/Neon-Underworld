/**
 * Prepares three-player cartel defence v2 E2E: leader, member (defender), attacker.
 * Run: npx tsx scripts/e2e-cartel-defence-setup.ts
 */
import { PrismaClient } from '@prisma/client';
import { buildPlayerIntelSnapshot } from '../src/lib/game-engine/combat/build-intel-snapshot';
import { calculateCanonicalNetWorthFromPlayer } from '../src/lib/game-engine/canonical-net-worth';

const prisma = new PrismaClient();

const LEADER_EMAIL = 'dev-pvp+neonviper@neonunderworld.local';
const MEMBER_EMAIL = 'dev-pvp+rustrunner@neonunderworld.local';
const ATTACKER_EMAIL = process.env.SEED_ADMIN_EMAIL ?? 'admin@neonunderworld.local';

async function main() {
  const [leaderUser, memberUser, attackerUser] = await Promise.all([
    prisma.user.findUnique({ where: { email: LEADER_EMAIL }, include: { player: { include: { district: true } } } }),
    prisma.user.findUnique({ where: { email: MEMBER_EMAIL }, include: { player: { include: { district: true } } } }),
    prisma.user.findUnique({ where: { email: ATTACKER_EMAIL }, include: { player: { include: { district: true, turnState: true } } } }),
  ]);

  if (!leaderUser?.player || !memberUser?.player || !attackerUser?.player) {
    throw new Error('PVP dev accounts missing — run npm run db:seed:dev-pvp');
  }

  const leader = leaderUser.player;
  const member = memberUser.player;
  const attacker = attackerUser.player;

  if (leader.districtId !== member.districtId) {
    throw new Error('Leader and member must share a district for cartel defence E2E');
  }

  const stamp = Date.now().toString(36).toUpperCase();
  const cartelName = `Defence E2E ${stamp}`;
  const cartelTag = `D${stamp.slice(-4)}`;

  await prisma.player.updateMany({
    where: { id: { in: [leader.id, member.id] } },
    data: { cartelId: null, cartelDonationPercent: 0 },
  });

  const cartel = await prisma.cartel.create({
    data: {
      name: cartelName,
      tag: cartelTag,
      leaderId: leader.id,
      treasuryCash: 100_000,
      thugs: 200,
      glocks: 20,
      uzis: 10,
      rides: 5,
    },
  });

  await prisma.player.update({
    where: { id: leader.id },
    data: { cartelId: cartel.id, thugs: 100, rides: 20 },
  });
  await prisma.player.update({
    where: { id: member.id },
    data: {
      cartelId: cartel.id,
      thugs: 50,
      rides: 10,
      cash: 120_000,
      bankCash: 500_000,
      travelling: false,
    },
  });

  await prisma.player.update({
    where: { id: attacker.id },
    data: {
      thugs: 200,
      rides: 50,
      glocks: 30,
      uzis: 20,
      aks: 10,
      cash: 200_000,
      districtId: member.districtId,
      travelling: false,
    },
  });

  if (attacker.turnState) {
    await prisma.playerTurnState.update({
      where: { playerId: attacker.id },
      data: { currentTurns: 500 },
    });
  }

  const memberNw = calculateCanonicalNetWorthFromPlayer({
    ...member,
    thugs: 50,
    cash: 120_000,
    bankCash: 500_000,
  });
  const intel = buildPlayerIntelSnapshot(
    {
      id: member.id,
      alias: member.alias,
      districtName: member.district.name,
      thugs: 50,
      glocks: member.glocks,
      uzis: member.uzis,
      aks: member.aks,
      cash: member.cash,
      hash: member.hash,
      shrooms: member.shrooms,
      coke: member.coke,
      heroin: member.heroin,
      cartelId: cartel.id,
      canonicalNetWorth: memberNw,
    },
    515151,
  );

  await prisma.report.deleteMany({
    where: {
      playerId: attacker.id,
      metadata: { path: ['type'], equals: 'PLAYER_INTEL' },
    },
  });

  const report = await prisma.report.create({
    data: {
      playerId: attacker.id,
      category: 'SCOUT',
      title: `Player Intel — ${member.alias}`,
      summary: `Cartel defence E2E intel · ${intel.confidencePercent}% confidence`,
      metadata: {
        type: 'PLAYER_INTEL',
        intel,
        idempotencyKey: 'e2e-cartel-defence-intel',
      } as object,
    },
  });

  console.log(JSON.stringify({
    cartelName,
    cartelTag,
    leaderAlias: leader.alias,
    memberAlias: member.alias,
    attackerAlias: attacker.alias,
    intelReportId: report.id,
    initialCartelThugs: 200,
    initialRides: 5,
  }));
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
