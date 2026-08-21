'use server';

import { prisma } from '@/lib/db/prisma';
import { requirePlayer } from '@/lib/auth/session';
import { streetDrugSaleSchema } from '@/lib/validation/schemas';
import { validateStreetDrugSale, streetDrugField } from '@/lib/game-engine/drug-street-sale';
import type { StreetDrugType } from '@/config/game/drug-street-prices';
import { calculateNetWorth } from '@/lib/game-engine/net-worth';
import { playerToResources, snapshotPlayerState } from '@/lib/game-engine/state';
import { assertGameplaySeasonActive } from '@/lib/game-engine/season-guard';
import { toUserMessage } from '@/lib/game-engine/gameplay-errors';
import { assertPlayerCanPerformAction } from '@/lib/game-engine/player-action-guard';
import type { ActionResult } from './auth.actions';

export interface StreetDrugSaleResult {
  drug: StreetDrugType;
  quantity: number;
  unitPrice: number;
  totalPayout: number;
  newCash: number;
  newNetWorth: number;
  newOwnedQuantity: number;
}

export async function streetDrugSaleAction(
  drug: StreetDrugType,
  quantity: number,
  idempotencyKey: string,
): Promise<ActionResult<StreetDrugSaleResult>> {
  try {
    const session = await requirePlayer();
    const parsed = streetDrugSaleSchema.safeParse({ drug, quantity, idempotencyKey });
    if (!parsed.success) {
      return { success: false, error: parsed.error.issues[0]?.message ?? 'Invalid input' };
    }

    const playerId = session.user.playerId!;

    const existing = await prisma.gameAction.findUnique({
      where: { playerId_idempotencyKey: { playerId, idempotencyKey } },
    });
    if (existing?.resultPayload) {
      return { success: true, data: existing.resultPayload as unknown as StreetDrugSaleResult };
    }

    const result = await prisma.$transaction(async (tx) => {
      const player = await tx.player.findUniqueOrThrow({
        where: { id: playerId },
        include: { district: true, season: true },
      });

      assertGameplaySeasonActive(player.season);
      assertPlayerCanPerformAction(player);
      if (player.travelling) {
        throw new Error('Cannot street-sell drugs while travelling.');
      }

      const field = streetDrugField(parsed.data.drug);
      const owned = player[field];

      const check = validateStreetDrugSale({
        districtSlug: player.district.slug,
        drug: parsed.data.drug,
        quantity: parsed.data.quantity,
        owned,
      });
      if (!check.valid) {
        throw new Error(check.error);
      }

      const beforeResources = playerToResources(player);
      const newOwned = owned - parsed.data.quantity;
      const newCash = player.cash + check.totalPayout;

      const updated = await tx.player.update({
        where: { id: playerId },
        data: {
          cash: newCash,
          [field]: newOwned,
        },
      });

      const afterResources = playerToResources(updated);
      const newNetWorth = calculateNetWorth(afterResources);

      const resultData: StreetDrugSaleResult = {
        drug: parsed.data.drug,
        quantity: parsed.data.quantity,
        unitPrice: check.unitPrice,
        totalPayout: check.totalPayout,
        newCash,
        newNetWorth,
        newOwnedQuantity: newOwned,
      };

      await tx.gameAction.create({
        data: {
          playerId,
          seasonId: player.seasonId,
          actionType: 'STREET_DRUG_SALE',
          idempotencyKey,
          requestPayload: parsed.data as object,
          resultPayload: resultData as object,
        },
      });

      await tx.economicAuditLog.create({
        data: {
          playerId,
          userId: session.user.id,
          eventType: 'STREET_DRUG_SALE',
          source: 'street_drugs',
          beforeState: snapshotPlayerState(player) as object,
          delta: {
            cash: check.totalPayout,
            [field]: -parsed.data.quantity,
          },
          afterState: snapshotPlayerState(updated) as object,
          metadata: {
            idempotencyKey,
            drug: parsed.data.drug,
            district: player.district.slug,
            unitPrice: check.unitPrice,
          },
        },
      });

      return resultData;
    });

    return { success: true, data: result };
  } catch (error) {
    console.error('Street drug sale error:', error);
    return { success: false, error: toUserMessage(error) };
  }
}
