/**
 * Server-side cartel defence attack check for E2E suite.
 */
import { randomUUID } from 'node:crypto';
import { PrismaClient } from '@prisma/client';
import { resolveAttackEncounter } from '../src/server/services/combat.service';

const prisma = new PrismaClient();

async function main() {
  const attackerEmail = process.env.SEED_ADMIN_EMAIL ?? 'admin@neonunderworld.local';
  const defenderEmail = 'dev-pvp+rustrunner@neonunderworld.local';

  const [attackerUser, defenderUser] = await Promise.all([
    prisma.user.findUnique({ where: { email: attackerEmail }, include: { player: true } }),
    prisma.user.findUnique({ where: { email: defenderEmail }, include: { player: true } }),
  ]);

  if (!attackerUser?.player || !defenderUser?.player) {
    throw new Error('Missing attacker or defender dev accounts');
  }

  const report = await prisma.report.findFirst({
    where: {
      playerId: attackerUser.player.id,
      metadata: { path: ['type'], equals: 'PLAYER_INTEL' },
    },
    orderBy: { createdAt: 'desc' },
  });
  if (!report) throw new Error('Missing player intel report for cartel defence E2E');

  const cartelBefore = await prisma.cartel.findFirst({
    where: { members: { some: { id: defenderUser.player.id } } },
    select: { id: true, thugs: true },
  });
  if (!cartelBefore) throw new Error('Defender cartel not found');

  const result = await resolveAttackEncounter(
    attackerUser.player.id,
    attackerUser.id,
    { kind: 'intel', scoutReportId: report.id },
    'DRIVE_BY',
    50,
    randomUUID(),
  );

  const cartelAfter = await prisma.cartel.findUniqueOrThrow({
    where: { id: cartelBefore.id },
    select: { thugs: true },
  });

  if (result.cartelResponseDeployed <= 0) {
    throw new Error(`Expected cartel response deployment, got ${result.cartelResponseDeployed}`);
  }

  console.log(
    JSON.stringify({
      cartelResponseDeployed: result.cartelResponseDeployed,
      cartelLocalSupport: result.cartelLocalSupport,
      cartelThugLosses: result.cartelThugLosses,
      cartelThugsBefore: cartelBefore.thugs,
      cartelThugsAfter: cartelAfter.thugs,
    }),
  );
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
