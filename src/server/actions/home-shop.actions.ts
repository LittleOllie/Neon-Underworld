'use server';

import { prisma } from '@/lib/db/prisma';
import { requirePlayer } from '@/lib/auth/session';
import { homeShopSellSchema } from '@/lib/validation/schemas';
import {
  getHomeShopDrugRule,
  getHomeShopSellPrice,
  isHomeShopDrug,
  type HomeShopDrugKey,
} from '@/config/game/shop-rules';
import { calculateCanonicalNetWorthFromPlayer } from '@/lib/game-engine/canonical-net-worth';
import { snapshotPlayerState } from '@/lib/game-engine/state';
import { SeasonInactiveError } from '@/lib/game-engine/errors';
import { throwIfValidationMessage, toUserMessage } from '@/lib/game-engine/gameplay-errors';
import type { ActionResult } from './auth.actions';

export type { HomeShopDrugKey };

export interface HomeShopSellResult {
  drug: HomeShopDrugKey;
  quantity: number;
  unitPrice: number;
  totalPayout: number;
  newCash: number;
  newOwnedQuantity: number;
  canonicalNetWorth: number;
}

function validateHomeShopSellContext(
  player: {
    cash: number;
    lifeStatus: string;
    travelling: boolean;
    hash: number;
    shrooms: number;
    coke: number;
    heroin: number;
  },
  drug: HomeShopDrugKey,
  quantity: number,
): string | null {
  if (!isHomeShopDrug(drug)) {
    return 'Invalid drug type.';
  }
  if (!Number.isInteger(quantity) || quantity < 1) {
    return 'Quantity must be a positive whole number.';
  }
  if (quantity > 1000) {
    return 'Maximum 1,000 units per sale.';
  }
  if (player.lifeStatus !== 'ACTIVE') {
    return 'Sales unavailable in your current status.';
  }
  if (player.travelling) {
    return 'Sales unavailable while travelling.';
  }

  const rule = getHomeShopDrugRule(drug);
  if (!rule) return 'Invalid drug type.';

  const owned = player[drug];
  if (owned <= 0) {
    return `You have no ${rule.displayName} to sell.`;
  }
  if (quantity > owned) {
    return `You don't own enough ${rule.displayName}.`;
  }

  const unitPrice = getHomeShopSellPrice(drug);
  const totalPayout = unitPrice * quantity;
  if (totalPayout <= 0 || !Number.isFinite(totalPayout)) {
    return 'Invalid sale total.';
  }
  if (totalPayout > Number.MAX_SAFE_INTEGER - player.cash) {
    return 'Sale would exceed safe cash limits.';
  }

  return null;
}

export async function homeShopSellAction(
  drug: string,
  quantity: number,
  idempotencyKey: string,
): Promise<ActionResult<HomeShopSellResult>> {
  try {
    const session = await requirePlayer();
    const parsed = homeShopSellSchema.safeParse({ drug, quantity, idempotencyKey });
    if (!parsed.success) {
      return { success: false, error: parsed.error.issues[0]?.message ?? 'Invalid input' };
    }

    const playerId = session.user.playerId!;

    const existing = await prisma.gameAction.findUnique({
      where: { playerId_idempotencyKey: { playerId, idempotencyKey } },
    });
    if (existing?.resultPayload) {
      return { success: true, data: existing.resultPayload as unknown as HomeShopSellResult };
    }

    const result = await prisma.$transaction(async (tx) => {
      const player = await tx.player.findUniqueOrThrow({
        where: { id: playerId },
        include: { season: true },
      });

      if (player.season.status !== 'ACTIVE') throw new SeasonInactiveError();

      throwIfValidationMessage(
        validateHomeShopSellContext(player, parsed.data.drug, parsed.data.quantity),
      );

      const rule = getHomeShopDrugRule(parsed.data.drug)!;
      const unitPrice = getHomeShopSellPrice(parsed.data.drug);
      const totalPayout = unitPrice * parsed.data.quantity;
      const owned = player[parsed.data.drug];
      const newQty = owned - parsed.data.quantity;
      const newCash = player.cash + totalPayout;

      const updatedPlayer = await tx.player.update({
        where: { id: playerId },
        data: {
          cash: newCash,
          [rule.field]: newQty,
        },
      });

      const canonicalNetWorth = calculateCanonicalNetWorthFromPlayer(updatedPlayer);

      const resultData: HomeShopSellResult = {
        drug: parsed.data.drug,
        quantity: parsed.data.quantity,
        unitPrice,
        totalPayout,
        newCash,
        newOwnedQuantity: newQty,
        canonicalNetWorth,
      };

      await tx.gameAction.create({
        data: {
          playerId,
          seasonId: player.seasonId,
          actionType: 'HOME_SHOP_SELL',
          idempotencyKey,
          requestPayload: parsed.data as object,
          resultPayload: resultData as object,
          turnsSpent: 0,
        },
      });

      await tx.economicAuditLog.create({
        data: {
          playerId,
          userId: session.user.id,
          eventType: 'HOME_SHOP_SELL',
          source: 'home',
          beforeState: snapshotPlayerState(player) as object,
          delta: { cash: totalPayout, [rule.field]: -parsed.data.quantity },
          afterState: snapshotPlayerState(updatedPlayer) as object,
          metadata: {
            idempotencyKey,
            drug: parsed.data.drug,
            unitPrice,
            totalPayout,
          },
        },
      });

      return resultData;
    }, { isolationLevel: 'Serializable' });

    return { success: true, data: result };
  } catch (error) {
    console.error('Home shop sell error:', error);
    return { success: false, error: toUserMessage(error) };
  }
}
