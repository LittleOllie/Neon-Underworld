/**
 * Resets cartel/membership state for three-player cartel+market E2E accounts.
 * Local/dev only — guarded by assertDevSeedAllowed.
 */
import { PrismaClient } from '@prisma/client';
import { assertDevSeedAllowed } from './lib/dev-guard';

const prisma = new PrismaClient();

const TEST_EMAILS = [
  process.env.SEED_ADMIN_EMAIL ?? 'admin@neonunderworld.local',
  'dev-pvp+neonviper@neonunderworld.local',
  'dev-pvp+rustrunner@neonunderworld.local',
];

async function resetPlayerMembership(playerId: string): Promise<void> {
  await prisma.cartelJoinRequest.updateMany({
    where: { applicantId: playerId, status: 'PENDING' },
    data: { status: 'CANCELLED' },
  });
  await prisma.cartelInvite.updateMany({
    where: { inviteeId: playerId, status: 'PENDING' },
    data: { status: 'DECLINED' },
  });

  const player = await prisma.player.findUnique({
    where: { id: playerId },
    include: { cartel: { include: { members: { select: { id: true } } } } },
  });
  if (!player?.cartelId || !player.cartel) return;

  const cartelId = player.cartelId;
  const isLeader = player.cartel.leaderId === playerId;
  const otherMembers = player.cartel.members.filter((m) => m.id !== playerId);

  if (isLeader && otherMembers.length > 0) {
    await prisma.cartel.update({
      where: { id: cartelId },
      data: { leaderId: otherMembers[0].id },
    });
  }

  await prisma.player.update({
    where: { id: playerId },
    data: { cartelId: null, cartelDonationPercent: 0 },
  });

  const remaining = await prisma.player.count({ where: { cartelId } });
  if (remaining === 0) {
    await prisma.cartel.delete({ where: { id: cartelId } }).catch(() => {});
  }
}

async function main() {
  assertDevSeedAllowed('e2e-cartel-verification-setup');

  for (const email of TEST_EMAILS) {
    const user = await prisma.user.findUnique({
      where: { email },
      include: { player: { select: { id: true } } },
    });
    if (user?.player?.id) {
      await resetPlayerMembership(user.player.id);
      console.log(`Reset cartel state for ${email}`);
    }
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
