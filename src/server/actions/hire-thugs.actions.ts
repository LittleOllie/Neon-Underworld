'use server';

import { prisma } from '@/lib/db/prisma';
import { requirePlayer } from '@/lib/auth/session';
import { hireThugsSchema } from '@/lib/validation/schemas';
import {
  HIRE_THUGS_MAX_QUANTITY,
  THUG_HIRE_PRICE,
  hireThugsTotalCost,
} from '@/config/game/hire-thugs-rules';
import { calculateCanonicalNetWorthFromPlayer } from '@/lib/game-engine/canonical-net-worth';
import { SeasonInactiveError } from '@/lib/game-engine/errors';
import { assertPlayerCanPerformAction } from '@/lib/game-engine/player-action-guard';
import { GameplayError, toUserMessage } from '@/lib/game-engine/gameplay-errors';
import { snapshotPlayerState } from '@/lib/game-engine/state';
import type { ActionResult } from './auth.actions';

export interface HireThugsResultData {
  quantity: number;
  unitPrice: number;
  totalCost: number;
  newCash: number;
  newThugs: number;
  newNetWorth: number;
  canonicalNetWorth: number;
}

function formatCash(amount: number): string {
  return `$${amount.toLocaleString()}`;
}

export async function hireThugsAction(
  quantity: number,
  idempotencyKey: string,
): Promise<ActionResult<HireThugsResultData>> {
  try {
    const session = await requirePlayer();
    const parsed = hireThugsSchema.safeParse({ quantity, idempotencyKey });
    if (!parsed.success) {
      return { success: false, error: parsed.error.issues[0]?.message ?? 'Invalid input' };
    }

    const playerId = session.user.playerId!;

    const existing = await prisma.gameAction.findUnique({
      where: { playerId_idempotencyKey: { playerId, idempotencyKey } },
    });
    if (existing?.resultPayload) {
      return { success: true, data: existing.resultPayload as unknown as HireThugsResultData };
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

      const totalCost = hireThugsTotalCost(qty);
      if (!Number.isFinite(totalCost) || totalCost <= 0) {
        throw new GameplayError('INVALID_QUANTITY');
      }

      if (player.cash < totalCost) {
        throw new GameplayError(
          'INSUFFICIENT_CASH',
          `You need ${formatCash(totalCost)} to hire ${qty.toLocaleString()} Thugs.`,
        );
      }

      const newCash = player.cash - totalCost;
      const newThugs = player.thugs + qty;

      const updated = await tx.player.update({
        where: { id: playerId },
        data: { cash: newCash, thugs: newThugs },
      });

      const canonicalNetWorth = calculateCanonicalNetWorthFromPlayer(updated);

      const resultData: HireThugsResultData = {
        quantity: qty,
        unitPrice: THUG_HIRE_PRICE,
        totalCost,
        newCash,
        newThugs,
        newNetWorth: canonicalNetWorth,
        canonicalNetWorth,
      };

      await tx.gameAction.create({
        data: {
          playerId,
          seasonId: player.seasonId,
          actionType: 'HIRE_THUGS',
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
          eventType: 'HIRE_THUGS',
          source: 'shop',
          beforeState: snapshotPlayerState(player) as object,
          delta: { cash: -totalCost, thugs: qty },
          afterState: snapshotPlayerState(updated) as object,
          metadata: { idempotencyKey, unitPrice: THUG_HIRE_PRICE, totalCost, quantity: qty },
        },
      });

      return resultData;
    }, { isolationLevel: 'Serializable' });

    return { success: true, data: result };
  } catch (error) {
    console.error('Hire thugs error:', error);
    return { success: false, error: toUserMessage(error) };
  }
}
