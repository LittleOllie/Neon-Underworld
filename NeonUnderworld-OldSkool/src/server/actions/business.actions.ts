'use server';

import { auth } from '@local/lib/auth/config';
import { prisma } from '@core/lib/db/prisma';
import {
  assignBusinessWorkersAction as coreAssignWorkers,
  collectBusinessSafeAction as coreCollectSafe,
  getBusinessesPageData as coreGetBusinessesPageData,
  purchaseBusinessAction as corePurchaseBusiness,
  removeBusinessWorkersAction as coreRemoveWorkers,
  storeBusinessDrugsAction as coreStoreDrugs,
  withdrawBusinessDrugsAction as coreWithdrawDrugs,
  type BusinessCollectResult,
  type BusinessDrugResult,
  type BusinessPurchaseResult,
  type BusinessWorkerResult,
  type BusinessesPageData,
} from '@core/server/actions/business.actions';
import type { BusinessType } from '@prisma/client';
import type { ActionResult } from '@core/server/actions/auth.actions';
import type { WithPlayerShell } from '@local/domain/player-shell.model';
import { ActivityService } from '@local/server/services/activity.service';
import { ACTIVITY_TYPES } from '@local/config/activity-types';
import { EmpireService } from '@local/server/services/empire.service';
import { finalizeLocalMutationShell } from '@local/server/services/shell-snapshot.service';
import type { CanonicalPlayerContext } from '@local/server/services/player.service';

export type { BusinessesPageData };

export async function getBusinessesPageDataFromContext(
  ctx: CanonicalPlayerContext,
): Promise<BusinessesPageData> {
  return coreGetBusinessesPageData(ctx.id);
}

async function wrapMutation<T extends { canonicalNetWorth: number; newCash: number }>(
  playerId: string,
  result: ActionResult<T>,
  activityMessage: string,
  paths: string[],
): Promise<ActionResult<WithPlayerShell<T>>> {
  if (!result.success) return result;

  await EmpireService.syncInventory(playerId);
  const updated = await prisma.player.findUniqueOrThrow({
    where: { id: playerId },
    include: { district: true, turnState: true },
  });

  const shell = await finalizeLocalMutationShell(playerId, updated, paths, {
    cash: result.data.newCash,
    netWorth: result.data.canonicalNetWorth,
  });

  await ActivityService.record(playerId, ACTIVITY_TYPES.BUSINESS, activityMessage);

  return {
    success: true,
    data: { ...result.data, shell },
  };
}

export async function purchaseBusinessAction(
  businessType: BusinessType,
  idempotencyKey: string,
): Promise<ActionResult<WithPlayerShell<BusinessPurchaseResult>>> {
  const session = await auth();
  const playerId = session?.user?.playerId;
  if (!playerId) return { success: false, error: 'Not authenticated' };

  const result = await corePurchaseBusiness(businessType, idempotencyKey);
  if (!result.success) return result;

  return wrapMutation(
    playerId,
    result,
    `Acquired ${result.data.businessName} for $${result.data.purchasePrice.toLocaleString()}.`,
    ['/businesses', '/empire', '/command'],
  );
}

export async function assignBusinessWorkersAction(
  businessId: string,
  quantity: number,
  idempotencyKey: string,
): Promise<ActionResult<WithPlayerShell<BusinessWorkerResult>>> {
  const session = await auth();
  const playerId = session?.user?.playerId;
  if (!playerId) return { success: false, error: 'Not authenticated' };

  const result = await coreAssignWorkers(businessId, quantity, idempotencyKey);
  return wrapMutation(
    playerId,
    result,
    `Assigned ${quantity.toLocaleString()} Workers to a business.`,
    ['/businesses', '/empire'],
  );
}

export async function removeBusinessWorkersAction(
  businessId: string,
  quantity: number,
  idempotencyKey: string,
): Promise<ActionResult<WithPlayerShell<BusinessWorkerResult>>> {
  const session = await auth();
  const playerId = session?.user?.playerId;
  if (!playerId) return { success: false, error: 'Not authenticated' };

  const result = await coreRemoveWorkers(businessId, quantity, idempotencyKey);
  return wrapMutation(
    playerId,
    result,
    `Removed ${quantity.toLocaleString()} Workers from a business.`,
    ['/businesses', '/empire'],
  );
}

export async function collectBusinessSafeAction(
  businessId: string,
  idempotencyKey: string,
): Promise<ActionResult<WithPlayerShell<BusinessCollectResult>>> {
  const session = await auth();
  const playerId = session?.user?.playerId;
  if (!playerId) return { success: false, error: 'Not authenticated' };

  const result = await coreCollectSafe(businessId, idempotencyKey);
  if (!result.success) return result;

  return wrapMutation(
    playerId,
    result,
    `Collected $${result.data.collected.toLocaleString()} from a business safe.`,
    ['/businesses', '/empire', '/command'],
  );
}

export async function storeBusinessDrugsAction(
  businessId: string,
  drug: string,
  quantity: number,
  idempotencyKey: string,
): Promise<ActionResult<WithPlayerShell<BusinessDrugResult>>> {
  const session = await auth();
  const playerId = session?.user?.playerId;
  if (!playerId) return { success: false, error: 'Not authenticated' };

  const result = await coreStoreDrugs(businessId, drug, quantity, idempotencyKey);
  return wrapMutation(
    playerId,
    result,
    `Stored ${quantity.toLocaleString()} ${drug} in business storage.`,
    ['/businesses', '/empire'],
  );
}

export async function withdrawBusinessDrugsAction(
  businessId: string,
  drug: string,
  quantity: number,
  idempotencyKey: string,
): Promise<ActionResult<WithPlayerShell<BusinessDrugResult>>> {
  const session = await auth();
  const playerId = session?.user?.playerId;
  if (!playerId) return { success: false, error: 'Not authenticated' };

  const result = await coreWithdrawDrugs(businessId, drug, quantity, idempotencyKey);
  return wrapMutation(
    playerId,
    result,
    `Withdrew ${quantity.toLocaleString()} ${drug} from business storage.`,
    ['/businesses', '/empire'],
  );
}
