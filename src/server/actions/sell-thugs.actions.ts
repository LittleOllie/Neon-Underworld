'use server';

import { prisma } from '@/lib/db/prisma';
import { requirePlayer } from '@/lib/auth/session';
import { sellThugsSchema } from '@/lib/validation/schemas';
import {
  HIRE_THUGS_MAX_QUANTITY,
  THUG_SELL_PRICE,
  sellThugsTotalPayout,
} from '@/config/game/hire-thugs-rules';
import { calculateCanonicalNetWorthFromPlayer } from '@/lib/game-engine/canonical-net-worth';
import { SeasonInactiveError } from '@/lib/game-engine/errors';
import { assertPlayerCanPerformAction } from '@/lib/game-engine/player-action-guard';
import { GameplayError, toUserMessage } from '@/lib/game-engine/gameplay-errors';
import { snapshotPlayerState } from '@/lib/game-engine/state';
import type { ActionResult } from './auth.actions';

export interface SellThugsResultData {
  quantity: number;
  unitPrice: number;
  totalPayout: number;
  newCash: number;
  newThugs: number;
  newNetWorth: number;
  canonicalNetWorth: number;
}

export async function sellThugsAction(
  quantity: number,
  idempotencyKey: string,
): Promise<ActionResult<SellThugsResultData>> {
  try {
    const session = await requirePlayer();
    const parsed = sellThugsSchema.safeParse({ quantity, idempotencyKey });
    if (!parsed.success) {
      return { success: false, error: parsed.error.issues[0]?.message ?? 'Invalid input' };
    }

    const playerId = session.user.playerId!;

    const existing = await prisma.gameAction.findUnique({
      where: { playerId_idempotencyKey: { playerId, idempotencyKey } },
    });
    if (existing?.resultPayload) {
      return { success: true, data: existing.resultPayload as unknown as SellThugsResultData };
    }

    const result = await prisma.$transaction(async (tx) => {
      const player = await tx.player.findUniqueOrThrow({
        where: { id: playerId },
        include: { season: true },
      });

      if (player.season.status !== 'ACTIVE') throw new SeasonInactiveError();
      assertPlayerCanPerformAction(player);

      const qty = parsed.data.quantity;
      if (!Number.isInteger(qty) || qty < 1 || qty > HIRE_THUGS_MAX_QUANTITY) {
        throw new GameplayError('INVALID_QUANTITY');
      }

      if (player.thugs < qty) {
        throw new GameplayError(
          'INVALID_QUANTITY',
          `You only have ${player.thugs.toLocaleString()} Thugs available to release.`,
        );
      }

      const totalPayout = sellThugsTotalPayout(qty);
      if (!Number.isFinite(totalPayout) || totalPayout <= 0) {
        throw new GameplayError('INVALID_QUANTITY');
      }

      if (totalPayout > Number.MAX_SAFE_INTEGER - player.cash) {
        throw new GameplayError('INVALID_QUANTITY', 'Sale would exceed safe cash limits.');
      }

      const newCash = player.cash + totalPayout;
      const newThugs = player.thugs - qty;

      const updated = await tx.player.update({
        where: { id: playerId },
        data: { cash: newCash, thugs: newThugs },
      });

      const canonicalNetWorth = calculateCanonicalNetWorthFromPlayer(updated);

      const resultData: SellThugsResultData = {
        quantity: qty,
        unitPrice: THUG_SELL_PRICE,
        totalPayout,
        newCash,
        newThugs,
        newNetWorth: canonicalNetWorth,
        canonicalNetWorth,
      };

      await tx.gameAction.create({
        data: {
          playerId,
          seasonId: player.seasonId,
          actionType: 'SELL_THUGS',
          idempotencyKey,
          requestPayload: { quantity: qty } as object,
          resultPayload: resultData as object,
          turnsSpent: 0,
        },
      });

      await tx.economicAuditLog.create({
        data: {
          playerId,
          userId: session.user.id,
          eventType: 'SELL_THUGS',
          source: 'shop',
          beforeState: snapshotPlayerState(player) as object,
          delta: { cash: totalPayout, thugs: -qty },
          afterState: snapshotPlayerState(updated) as object,
          metadata: { idempotencyKey, unitPrice: THUG_SELL_PRICE, totalPayout, quantity: qty },
        },
      });

      return resultData;
    }, { isolationLevel: 'Serializable' });

    return { success: true, data: result };
  } catch (error) {
    console.error('Sell thugs error:', error);
    return { success: false, error: toUserMessage(error) };
  }
}
