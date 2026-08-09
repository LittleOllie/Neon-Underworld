import { prisma } from '@core/lib/db/prisma';
import { ONLINE_THRESHOLD_MS } from '@local/config/game';

export const PlayerStatusService = {
  resolveLastSeen(
    lastLoginAt: Date | null | undefined,
    statusLastSeen: Date | null | undefined,
    fallbackUpdatedAt?: Date,
  ): Date | null {
    if (statusLastSeen) return statusLastSeen;
    if (lastLoginAt) return lastLoginAt;
    return fallbackUpdatedAt ?? null;
  },

  isOnline(lastSeen: Date | null | undefined, now = Date.now()): boolean {
    if (!lastSeen) return false;
    return now - lastSeen.getTime() < ONLINE_THRESHOLD_MS;
  },

  async touchLastSeen(playerId: string, at = new Date()): Promise<void> {
    await prisma.playerStatusExt.upsert({
      where: { playerId },
      create: { playerId, lastSeenAt: at },
      update: { lastSeenAt: at, updatedAt: at },
    });
  },

  async setNotification(playerId: string, message: string): Promise<void> {
    await prisma.playerStatusExt.upsert({
      where: { playerId },
      create: { playerId, notification: message },
      update: { notification: message },
    });
  },
};
