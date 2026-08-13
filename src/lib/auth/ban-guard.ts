import { prisma } from '@/lib/db/prisma';
import { GameplayError } from '@/lib/game-engine/gameplay-errors';

/** Reject gameplay for users banned after session issuance. */
export async function assertUserNotBanned(userId: string): Promise<void> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { bannedAt: true },
  });
  if (user?.bannedAt) {
    throw new GameplayError('ACCOUNT_RESTRICTED');
  }
}
