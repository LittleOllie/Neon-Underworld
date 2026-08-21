import { prisma } from '@/lib/db/prisma';
import { TURNS_CONFIG } from '@/config/game/balance';
import { settleTurnRegeneration } from '@/lib/game-engine/turns';
import { isAdminSchemaReady } from '@/lib/db/admin-schema-readiness';
import { getPlayerSeasonActivatedAt, listActivatedHumanPlayerIds } from '@/lib/db/admin-analytics-db';

const ADMIN_TURN_GRANT_CAP = TURNS_CONFIG.turnCap;

async function logAdminAction(
  adminUserId: string,
  action: string,
  metadata: object,
  seasonId?: string,
  targetType?: string,
  targetId?: string,
) {
  await prisma.adminAuditLog.create({
    data: {
      adminUserId,
      action,
      targetType: targetType ?? null,
      targetId: targetId ?? null,
      metadata: seasonId ? { ...metadata, seasonId } : metadata,
    },
  });
}

export const AdminTurnGrantService = {
  /** Admin grants bypass normal regen cap intentionally — documented here. */
  adminTurnCap: ADMIN_TURN_GRANT_CAP,

  async grantToPlayer(
    adminUserId: string,
    playerId: string,
    amount: number,
    reason: string,
  ): Promise<{ newTurns: number; playerAlias: string }> {
    if (!Number.isInteger(amount) || amount <= 0 || amount > 10_000) {
      throw new Error('Grant amount must be between 1 and 10,000');
    }
    const trimmedReason = reason.trim();
    if (trimmedReason.length < 3) throw new Error('Reason is required (min 3 characters)');

    const player = await prisma.player.findUnique({
      where: { id: playerId },
      include: { turnState: true, user: { select: { email: true } } },
    });
    if (!player?.turnState) throw new Error('Player not found');
    if (await isAdminSchemaReady()) {
      const activatedAt = await getPlayerSeasonActivatedAt(playerId);
      if (!activatedAt) throw new Error('Player has not activated in the current round');
    }

    const settled = settleTurnRegeneration({
      currentTurns: player.turnState.currentTurns,
      lastRegeneratedAt: player.turnState.lastRegeneratedAt,
      turnCap: player.turnState.turnCap,
      regenerationRatePerMs: player.turnState.regenerationRate,
    });

    const newTurns = Math.min(settled.currentTurns + amount, ADMIN_TURN_GRANT_CAP);

    await prisma.$transaction(async (tx) => {
      await tx.playerTurnState.update({
        where: { playerId },
        data: { currentTurns: newTurns },
      });
    });

    await logAdminAction(
      adminUserId,
      'TURN_GRANT_PLAYER',
      { playerId, alias: player.alias, amount, reason: trimmedReason, newTurns },
      player.seasonId,
      'player',
      playerId,
    );

    return { newTurns, playerAlias: player.alias };
  },

  async previewBulkGrant(seasonId: string): Promise<{ affectedCount: number }> {
    if (await isAdminSchemaReady()) {
      const ids = await listActivatedHumanPlayerIds(seasonId);
      return { affectedCount: ids.length };
    }
    return { affectedCount: 0 };
  },

  async grantBulkToActiveHumans(
    adminUserId: string,
    seasonId: string,
    amount: number,
    reason: string,
    confirmation: string,
  ): Promise<{ affectedCount: number }> {
    if (!Number.isInteger(amount) || amount <= 0 || amount > 10_000) {
      throw new Error('Grant amount must be between 1 and 10,000');
    }
    const trimmedReason = reason.trim();
    if (trimmedReason.length < 3) throw new Error('Reason is required');

    const preview = await this.previewBulkGrant(seasonId);
    const expected = `GRANT ${amount} TO ${preview.affectedCount}`;
    if (confirmation.trim().toUpperCase() !== expected) {
      throw new Error(`Type "${expected}" to confirm bulk grant`);
    }

    const activatedIds = await listActivatedHumanPlayerIds(seasonId);
    const players =
      activatedIds.length > 0
        ? await prisma.player.findMany({
            where: { id: { in: activatedIds }, seasonId },
            include: { turnState: true },
          })
        : [];

    let affectedCount = 0;

    await prisma.$transaction(async (tx) => {
      for (const player of players) {
        if (!player.turnState) continue;
        const settled = settleTurnRegeneration({
          currentTurns: player.turnState.currentTurns,
          lastRegeneratedAt: player.turnState.lastRegeneratedAt,
          turnCap: player.turnState.turnCap,
          regenerationRatePerMs: player.turnState.regenerationRate,
        });
        const newTurns = Math.min(settled.currentTurns + amount, ADMIN_TURN_GRANT_CAP);
        await tx.playerTurnState.update({
          where: { playerId: player.id },
          data: { currentTurns: newTurns },
        });
        affectedCount += 1;
      }
    });

    await logAdminAction(
      adminUserId,
      'TURN_GRANT_BULK',
      { seasonId, amount, reason: trimmedReason, affectedCount },
      seasonId,
    );

    return { affectedCount };
  },
};
