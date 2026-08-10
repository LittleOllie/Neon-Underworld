'use server';

import {
  homeShopSellAction as coreHomeShopSellAction,
  type HomeShopSellResult,
  type HomeShopDrugKey,
} from '@core/server/actions/home-shop.actions';
import { HOME_SHOP_DRUGS } from '@core/config/game/shop-rules';
import type { ActionResult } from '@core/server/actions/auth.actions';
import { auth } from '@local/lib/auth/config';
import { prisma } from '@core/lib/db/prisma';
import { ACTIVITY_TYPES } from '@local/config/activity-types';
import { ActivityService } from '@local/server/services/activity.service';
import { EmpireService } from '@local/server/services/empire.service';
import { revalidatePlayerGameplayCache } from '@local/server/services/gameplay-cache';

export type { HomeShopSellResult, HomeShopDrugKey };

export async function homeShopSellAction(
  drug: HomeShopDrugKey,
  quantity: number,
  idempotencyKey: string,
): Promise<ActionResult<HomeShopSellResult>> {
  const result = await coreHomeShopSellAction(drug, quantity, idempotencyKey);
  if (!result.success) return result;

  const session = await auth();
  const playerId = session?.user?.playerId;
  if (!playerId) return { success: false, error: 'Not authenticated' };

  const drugLabel = HOME_SHOP_DRUGS.find((d) => d.key === drug)?.displayName ?? drug;

  await EmpireService.syncInventory(playerId);
  const updated = await prisma.player.findUniqueOrThrow({ where: { id: playerId } });

  await ActivityService.record(
    playerId,
    ACTIVITY_TYPES.HOME_SHOP_SELL,
    `Sold ${result.data.quantity}× ${drugLabel} for $${result.data.totalPayout.toLocaleString()}.`,
    { homeShop: result.data },
  );

  revalidatePlayerGameplayCache(playerId, updated.seasonId);

  return { success: true, data: result.data };
}
