/**
 * Seeds deterministic report fixtures for E2E (fresh player or admin).
 * Usage: npx tsx scripts/seed-e2e-report-fixtures.ts
 */
import { PrismaClient } from '@prisma/client';
import { assertDevSeedAllowed } from './lib/dev-guard';
import { FRESH_E2E_EMAIL } from './seed-fresh-e2e-player';

const prisma = new PrismaClient();

async function main() {
  assertDevSeedAllowed('seed-e2e-report-fixtures');

  const email = process.env.E2E_REPORT_PLAYER_EMAIL ?? FRESH_E2E_EMAIL;
  const user = await prisma.user.findUnique({
    where: { email: email.toLowerCase() },
    include: { player: { select: { id: true, alias: true } } },
  });
  if (!user?.player) {
    throw new Error(`Player not found for ${email} — run db:seed:fresh-e2e first`);
  }

  const playerId = user.player.id;
  await prisma.report.deleteMany({ where: { playerId } });

  await prisma.report.createMany({
    data: [
      {
        playerId,
        category: 'COMBAT',
        title: 'E2E Attack Report — DevTarget',
        summary: 'Unread combat report fixture',
        body: 'Attacker: FreshE2E · Defender: DevTarget · Outcome: WIN',
        read: false,
        metadata: { type: 'COMBAT', e2eFixture: true } as object,
      },
      {
        playerId,
        category: 'SCOUT',
        title: `Player Intel — DevTarget`,
        summary: 'Unread intel report fixture · 72% confidence',
        read: false,
        metadata: { type: 'PLAYER_INTEL', e2eFixture: true } as object,
      },
      {
        playerId,
        category: 'SYSTEM',
        title: 'E2E System Notice',
        summary: 'Optional system report fixture',
        read: true,
        metadata: { e2eFixture: true } as object,
      },
    ],
  });

  console.log(JSON.stringify({ playerId, alias: user.player.alias, reportsCreated: 3 }));
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
