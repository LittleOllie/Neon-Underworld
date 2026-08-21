import { prisma } from '@/lib/db/prisma';
import {
  isDamagingAttackResult,
  nextOfflineHitCount,
  resolveOnlineSessionStart,
  shouldBlockOfflineProtectedDefender,
  shouldResetOfflineProtectionCycle,
  type OfflineProtectionState,
} from '@/lib/game-engine/combat/offline-protection';
import { isPlayerOffline, LAST_SEEN_WRITE_THROTTLE_MS } from '@/config/game/offline-protection';

export const OfflineProtectionService = {
  async getStateInTx(
    tx: Parameters<Parameters<typeof prisma.$transaction>[0]>[0],
    playerId: string,
  ): Promise<OfflineProtectionState> {
    const ext = await tx.playerStatusExt.findUnique({
      where: { playerId },
      select: {
        offlineDamagingHits: true,
        offlineProtectionActive: true,
        lastSeenAt: true,
        onlineSessionStartedAt: true,
      },
    });
    return {
      offlineDamagingHits: ext?.offlineDamagingHits ?? 0,
      offlineProtectionActive: ext?.offlineProtectionActive ?? false,
      lastSeenAt: ext?.lastSeenAt ?? null,
      onlineSessionStartedAt: ext?.onlineSessionStartedAt ?? null,
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

  /** Full cycle reset — only after 30 continuous minutes online (see touchLastSeenWithProtectionEval). */
  async resetProtectionCycleInTx(
    tx: Parameters<Parameters<typeof prisma.$transaction>[0]>[0],
    playerId: string,
  ): Promise<void> {
    await tx.playerStatusExt.upsert({
      where: { playerId },
      create: {
        playerId,
        offlineDamagingHits: 0,
        offlineProtectionActive: false,
        onlineSessionStartedAt: new Date(),
      },
      update: {
        offlineDamagingHits: 0,
        offlineProtectionActive: false,
      },
    });
  },

  /**
   * Lazy online-activity touch: updates lastSeen, tracks continuous online session,
   * and resets offline protection after 30 minutes of uninterrupted activity.
   */
  async touchLastSeenWithProtectionEval(playerId: string, at = new Date()): Promise<void> {
    const atMs = at.getTime();
    const ext = await prisma.playerStatusExt.findUnique({
      where: { playerId },
      select: {
        lastSeenAt: true,
        onlineSessionStartedAt: true,
        offlineDamagingHits: true,
        offlineProtectionActive: true,
      },
    });

    const wasOffline = isPlayerOffline(ext?.lastSeenAt, atMs);
    const sessionStart = resolveOnlineSessionStart(
      ext?.lastSeenAt,
      ext?.onlineSessionStartedAt,
      atMs,
    );

    const stateForReset: OfflineProtectionState = {
      offlineDamagingHits: ext?.offlineDamagingHits ?? 0,
      offlineProtectionActive: ext?.offlineProtectionActive ?? false,
      lastSeenAt: ext?.lastSeenAt ?? null,
      onlineSessionStartedAt: sessionStart,
    };
    const resetCycle = !wasOffline && shouldResetOfflineProtectionCycle(stateForReset, atMs);

    const recentlyTouched =
      ext?.lastSeenAt != null && atMs - ext.lastSeenAt.getTime() < LAST_SEEN_WRITE_THROTTLE_MS;
    if (recentlyTouched && !wasOffline && !resetCycle) {
      return;
    }

    const playerExists = await prisma.player.findUnique({
      where: { id: playerId },
      select: { id: true },
    });
    if (!playerExists) return;

    await prisma.playerStatusExt.upsert({
      where: { playerId },
      create: {
        playerId,
        lastSeenAt: at,
        onlineSessionStartedAt: sessionStart,
        offlineDamagingHits: 0,
        offlineProtectionActive: false,
      },
      update: {
        lastSeenAt: at,
        onlineSessionStartedAt: sessionStart,
        ...(resetCycle
          ? { offlineDamagingHits: 0, offlineProtectionActive: false }
          : {}),
      },
    });
  },

  defenderWasOfflineAt(lastSeenAt: Date | null | undefined, now = Date.now()): boolean {
    return isPlayerOffline(lastSeenAt, now);
  },

  isDamagingAttackResult,
};
