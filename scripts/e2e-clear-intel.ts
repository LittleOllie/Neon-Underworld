/** Clears player intel reports for admin — used before attack empty-state E2E. */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const adminEmail = process.env.SEED_ADMIN_EMAIL ?? 'admin@neonunderworld.local';
  const admin = await prisma.user.findUnique({
    where: { email: adminEmail.toLowerCase() },
    include: { player: true },
  });
  if (!admin?.player) return;

  await prisma.report.deleteMany({
    where: {
      playerId: admin.player.id,
      metadata: { path: ['type'], equals: 'PLAYER_INTEL' },
    },
  });
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
