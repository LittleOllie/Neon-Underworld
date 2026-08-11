import { prisma } from '@/lib/db/prisma';
import {
  isDamagingAttackResult,
  nextOfflineHitCount,
  shouldBlockOfflineProtectedDefender,
  type OfflineProtectionState,
} from '@/lib/game-engine/combat/offline-protection';
import { isPlayerOffline } from '@/config/game/offline-protection';

export const OfflineProtectionService = {
  async getStateInTx(
    tx: Parameters<Parameters<typeof prisma.$transaction>[0]>[0],
    playerId: string,
  ): Promise<OfflineProtectionState> {
    const ext = await tx.playerStatusExt.findUnique({
      where: { playerId },
      select: { offlineDamagingHits: true, offlineProtectionActive: true, lastSeenAt: true },
    });
    return {
      offlineDamagingHits: ext?.offlineDamagingHits ?? 0,
      offlineProtectionActive: ext?.offlineProtectionActive ?? false,
      lastSeenAt: ext?.lastSeenAt ?? null,
    };
  },

  isDefenderProtected(state: OfflineProtectionState, now = Date.now()): boolean {
    return shouldBlockOfflineProtectedDefender(state, now);
  },

  async recordDefenderOfflineHitInTx(
    tx: Parameters<Parameters<typeof prisma.$transaction>[0]>[0],
    defenderId: string,
    defenderWasOffline: boolean,
    damaging: boolean,
  ): Promise<void> {
    if (!defenderWasOffline || !damaging) return;

    const ext = await tx.playerStatusExt.findUnique({
      where: { playerId: defenderId },
      select: { offlineDamagingHits: true },
    });
    const currentHits = ext?.offlineDamagingHits ?? 0;
    const next = nextOfflineHitCount(currentHits, damaging, defenderWasOffline);

    await tx.playerStatusExt.upsert({
      where: { playerId: defenderId },
      create: {
        playerId: defenderId,
        offlineDamagingHits: next.hits,
        offlineProtectionActive: next.protectionActive,
      },
      update: {
        offlineDamagingHits: next.hits,
        offlineProtectionActive: next.protectionActive,
      },
    });
  },

  async resetProtectionCycleInTx(
    tx: Parameters<Parameters<typeof prisma.$transaction>[0]>[0],
    playerId: string,
  ): Promise<void> {
    await tx.playerStatusExt.upsert({
      where: { playerId },
      create: { playerId, offlineDamagingHits: 0, offlineProtectionActive: false },
      update: { offlineDamagingHits: 0, offlineProtectionActive: false },
    });
  },

  defenderWasOfflineAt(lastSeenAt: Date | null | undefined, now = Date.now()): boolean {
    return isPlayerOffline(lastSeenAt, now);
  },

  isDamagingAttackResult,
};
