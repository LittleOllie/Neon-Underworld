'use server';

import { requireActivePlayerSession } from '@local/lib/auth/active-session';
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
  type BusinessUpgradeResult,
  type BusinessSecurityResult,
  type BusinessesPageData,
  upgradeBusinessAction as coreUpgradeBusiness,
  assignBusinessSecurityAction as coreAssignSecurity,
  removeBusinessSecurityAction as coreRemoveSecurity,
} from '@core/server/actions/business.actions';
import type { BusinessType } from '@prisma/client';
import type { ActionResult } from '@core/server/actions/auth.actions';
import type { WithPlayerShell } from '@local/domain/player-shell.model';
import { ActivityService } from '@local/server/services/activity.service';
import { ACTIVITY_TYPES } from '@local/config/activity-types';
import { OS_TERMS, resourceLabel } from '@local/config/terminology';
import { EmpireService } from '@local/server/services/empire.service';
import { finalizeLocalMutationShell } from '@local/server/services/shell-snapshot.service';
import type { CanonicalPlayerContext } from '@local/server/services/player.service';
import { assertSessionMatchesPlayer } from '@local/lib/auth/session-player';
import {
  recordPostGameplayAnalytics,
  GAMEPLAY_ANALYTICS_EVENTS,
} from '@local/server/services/gameplay-analytics-hook';

export type { BusinessesPageData };

export async function getBusinessesPageDataFromContext(
  ctx: CanonicalPlayerContext,
): Promise<BusinessesPageData> {
  await assertSessionMatchesPlayer(ctx.id);
  return coreGetBusinessesPageData(ctx.id);
}

export async function refreshBusinessesPageDataAction(): Promise<ActionResult<BusinessesPageData>> {
  const active = await requireActivePlayerSession();
  if (!active) return { success: false, error: 'Not authenticated' };
  const data = await coreGetBusinessesPageData(active.playerId);
  return { success: true, data };
}

async function wrapMutation<T extends { canonicalNetWorth: number; newCash: number }>(
  playerId: string,
  result: ActionResult<T>,
  activityMessage: string,
  paths: string[],
  analyticsEvent?: (typeof GAMEPLAY_ANALYTICS_EVENTS)[keyof typeof GAMEPLAY_ANALYTICS_EVENTS],
  analyticsMetadata?: Record<string, string | number | boolean | null>,
): Promise<ActionResult<WithPlayerShell<T>>> {
  if (!result.success) return result;

  try {
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

    if (analyticsEvent) {
      await recordPostGameplayAnalytics(updated, analyticsEvent, analyticsMetadata);
    }

    return {
      success: true,
      data: { ...result.data, shell },
    };
  } catch (error) {
    console.error('Business mutation shell error:', error);
    return {
      success: true,
      data: {
        ...result.data,
        shell: {
          cash: result.data.newCash,
          netWorth: result.data.canonicalNetWorth,
          turns: 0,
          turnCap: 0,
          rank: 0,
        },
      },
    };
  }
}

export async function purchaseBusinessAction(
  businessType: BusinessType,
  idempotencyKey: string,
): Promise<ActionResult<WithPlayerShell<BusinessPurchaseResult>>> {
  const active = await requireActivePlayerSession();
  if (!active) return { success: false, error: 'Not authenticated' };
  const playerId = active.playerId;

  const result = await corePurchaseBusiness(businessType, idempotencyKey);
  if (!result.success) return result;

  return wrapMutation(
    playerId,
    result,
    `Acquired ${result.data.businessName} for $${result.data.purchasePrice.toLocaleString()}.`,
    ['/businesses', '/empire', '/command'],
    GAMEPLAY_ANALYTICS_EVENTS.BUSINESS_PURCHASED,
    { businessType, purchasePrice: result.data.purchasePrice },
  );
}

export async function assignBusinessWorkersAction(
  businessId: string,
  quantity: number,
  idempotencyKey: string,
): Promise<ActionResult<WithPlayerShell<BusinessWorkerResult>>> {
  const active = await requireActivePlayerSession();
  if (!active) return { success: false, error: 'Not authenticated' };
  const playerId = active.playerId;

  const result = await coreAssignWorkers(businessId, quantity, idempotencyKey);
  return wrapMutation(
    playerId,
    result,
    `Assigned ${quantity.toLocaleString()} ${OS_TERMS.specialists} to a business.`,
    ['/businesses', '/empire'],
    GAMEPLAY_ANALYTICS_EVENTS.BUSINESS_WORKERS_ASSIGNED,
    { businessId, quantity },
  );
}

export async function removeBusinessWorkersAction(
  businessId: string,
  quantity: number,
  idempotencyKey: string,
): Promise<ActionResult<WithPlayerShell<BusinessWorkerResult>>> {
  const active = await requireActivePlayerSession();
  if (!active) return { success: false, error: 'Not authenticated' };
  const playerId = active.playerId;

  const result = await coreRemoveWorkers(businessId, quantity, idempotencyKey);
  return wrapMutation(
    playerId,
    result,
    `Removed ${quantity.toLocaleString()} ${OS_TERMS.specialists} from a business.`,
    ['/businesses', '/empire'],
    GAMEPLAY_ANALYTICS_EVENTS.BUSINESS_WORKERS_REMOVED,
    { businessId, quantity },
  );
}

export async function collectBusinessSafeAction(
  businessId: string,
  idempotencyKey: string,
): Promise<ActionResult<WithPlayerShell<BusinessCollectResult>>> {
  const active = await requireActivePlayerSession();
  if (!active) return { success: false, error: 'Not authenticated' };
  const playerId = active.playerId;

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
  const active = await requireActivePlayerSession();
  if (!active) return { success: false, error: 'Not authenticated' };
  const playerId = active.playerId;

  const result = await coreStoreDrugs(businessId, drug, quantity, idempotencyKey);
  return wrapMutation(
    playerId,
    result,
    `Stored ${quantity.toLocaleString()} ${resourceLabel(drug as 'hash' | 'shrooms' | 'coke' | 'heroin')} in business storage.`,
    ['/businesses', '/empire'],
  );
}

export async function withdrawBusinessDrugsAction(
  businessId: string,
  drug: string,
  quantity: number,
  idempotencyKey: string,
): Promise<ActionResult<WithPlayerShell<BusinessDrugResult>>> {
  const active = await requireActivePlayerSession();
  if (!active) return { success: false, error: 'Not authenticated' };
  const playerId = active.playerId;

  const result = await coreWithdrawDrugs(businessId, drug, quantity, idempotencyKey);
  return wrapMutation(
    playerId,
    result,
    `Withdrew ${quantity.toLocaleString()} ${resourceLabel(drug as 'hash' | 'shrooms' | 'coke' | 'heroin')} from business storage.`,
    ['/businesses', '/empire'],
  );
}

export async function upgradeBusinessAction(
  businessId: string,
  idempotencyKey: string,
): Promise<ActionResult<WithPlayerShell<BusinessUpgradeResult>>> {
  const active = await requireActivePlayerSession();
  if (!active) return { success: false, error: 'Not authenticated' };
  const playerId = active.playerId;

  const result = await coreUpgradeBusiness(businessId, idempotencyKey);
  if (!result.success) return result;

  return wrapMutation(
    playerId,
    result,
    `Upgraded business to Level ${result.data.upgradeTargetLevel} (construction started).`,
    ['/businesses', '/empire', '/command'],
    GAMEPLAY_ANALYTICS_EVENTS.BUSINESS_UPGRADED,
    { businessId, targetLevel: result.data.upgradeTargetLevel },
  );
}

export async function assignBusinessSecurityAction(
  businessId: string,
  quantity: number,
  idempotencyKey: string,
): Promise<ActionResult<WithPlayerShell<BusinessSecurityResult>>> {
  const active = await requireActivePlayerSession();
  if (!active) return { success: false, error: 'Not authenticated' };
  const playerId = active.playerId;

  const result = await coreAssignSecurity(businessId, quantity, idempotencyKey);
  return wrapMutation(
    playerId,
    result,
    `Assigned ${quantity.toLocaleString()} ${OS_TERMS.enforcers} to business security.`,
    ['/businesses', '/empire', '/attack', '/produce'],
  );
}

export async function removeBusinessSecurityAction(
  businessId: string,
  quantity: number,
  idempotencyKey: string,
): Promise<ActionResult<WithPlayerShell<BusinessSecurityResult>>> {
  const active = await requireActivePlayerSession();
  if (!active) return { success: false, error: 'Not authenticated' };
  const playerId = active.playerId;

  const result = await coreRemoveSecurity(businessId, quantity, idempotencyKey);
  return wrapMutation(
    playerId,
    result,
    `Removed ${quantity.toLocaleString()} ${OS_TERMS.enforcers} from business security.`,
    ['/businesses', '/empire', '/attack', '/produce'],
  );
}
