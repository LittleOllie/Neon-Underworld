'use server';

import type { BusinessType } from '@prisma/client';
import { prisma } from '@/lib/db/prisma';
import { requirePlayer } from '@/lib/auth/session';
import {
  businessCollectSchema,
  businessDrugTransferSchema,
  businessPurchaseSchema,
  businessWorkerSchema,
} from '@/lib/validation/schemas';
import {
  BUSINESS_TYPE_RULES,
  BUSINESS_TYPES,
  businessPurchasePrice,
  getBusinessTypeRule,
} from '@/config/game/business-rules';
import { calculatePlayerCanonicalNetWorthSync } from '@/lib/game-engine/business/net-worth';
import { SeasonInactiveError } from '@/lib/game-engine/errors';
import { assertPlayerCanPerformAction } from '@/lib/game-engine/player-action-guard';
import { GameplayError, toUserMessage } from '@/lib/game-engine/gameplay-errors';
import { runSerializableTransaction } from '@/lib/db/serializable-transaction';
import { snapshotPlayerState } from '@/lib/game-engine/state';
import {
  assertBusinessDrugKey,
  buildPortfolioSummary,
  businessNameForPurchase,
  nextBusinessSequence,
  settleBusinessInTransaction,
  toBusinessViewModel,
  validateAssignWorkers,
  validateDrugTransfer,
  validateDrugWithdraw,
  validatePurchase,
  validateRemoveWorkers,
} from '@/server/services/business.service';
import type { ActionResult } from './auth.actions';

export interface BusinessCatalogEntry {
  type: BusinessType;
  displayName: string;
  purchasePrice: number;
  streetNwContribution: number;
  passiveIncomeMultiplier: number;
  safeCapacity: number;
  drugStorageCapacity: number;
  blurb: string;
}

export interface BusinessesPageData {
  catalog: BusinessCatalogEntry[];
  businesses: ReturnType<typeof toBusinessViewModel>[];
  summary: ReturnType<typeof buildPortfolioSummary>;
  streetDrugs: { hash: number; shrooms: number; coke: number; heroin: number };
  streetWorkers: number;
  cash: number;
  canonicalNetWorth: number;
  canPurchase: boolean;
  ownedCount: number;
  maxBusinesses: number;
}

export interface BusinessMutationResult {
  businessId: string;
  newCash: number;
  streetWorkers: number;
  canonicalNetWorth: number;
}

export interface BusinessPurchaseResult extends BusinessMutationResult {
  businessType: BusinessType;
  businessName: string;
  purchasePrice: number;
}

export interface BusinessCollectResult extends BusinessMutationResult {
  collected: number;
  newSafeCash: number;
}

export interface BusinessWorkerResult extends BusinessMutationResult {
  quantity: number;
  assignedWorkers: number;
}

export interface BusinessDrugResult extends BusinessMutationResult {
  drug: string;
  quantity: number;
}

function formatCatalog(): BusinessCatalogEntry[] {
  return BUSINESS_TYPES.map((type) => {
    const rule = getBusinessTypeRule(type);
    return {
      type,
      displayName: rule.displayName,
      purchasePrice: rule.purchasePrice,
      streetNwContribution: Math.floor(rule.purchasePrice * 0.5),
      passiveIncomeMultiplier: rule.passiveIncomeMultiplier,
      safeCapacity: rule.safeCapacity,
      drugStorageCapacity: rule.drugStorageCapacity,
      blurb: rule.blurb,
    };
  });
}

async function loadSettledBusinesses(playerId: string) {
  return runSerializableTransaction(async (tx) => {
    const rows = await tx.business.findMany({
      where: { playerId },
      include: { district: true },
      orderBy: { createdAt: 'asc' },
    });
    for (const row of rows) {
      await settleBusinessInTransaction(tx, row.id);
    }
    const settled = await tx.business.findMany({
      where: { playerId },
      include: { district: true },
      orderBy: { createdAt: 'asc' },
    });
    return settled;
  });
}

export async function getBusinessesPageData(playerId: string): Promise<BusinessesPageData> {
  const player = await prisma.player.findUniqueOrThrow({ where: { id: playerId } });
  const settled = await loadSettledBusinesses(playerId);
  const businesses = settled.map((b) => toBusinessViewModel(b, b.district.name));
  const summary = buildPortfolioSummary(player.prostitutes, businesses);
  const canonicalNetWorth = calculatePlayerCanonicalNetWorthSync(player, settled);

  return {
    catalog: formatCatalog(),
    businesses,
    summary,
    streetDrugs: {
      hash: player.hash,
      shrooms: player.shrooms,
      coke: player.coke,
      heroin: player.heroin,
    },
    streetWorkers: player.prostitutes,
    cash: player.cash,
    canonicalNetWorth,
    canPurchase: settled.length < 10,
    ownedCount: settled.length,
    maxBusinesses: 10,
  };
}

async function idempotentAction<T>(
  playerId: string,
  idempotencyKey: string,
): Promise<T | null> {
  const existing = await prisma.gameAction.findUnique({
    where: { playerId_idempotencyKey: { playerId, idempotencyKey } },
  });
  if (existing?.resultPayload) {
    return existing.resultPayload as unknown as T;
  }
  return null;
}

export async function purchaseBusinessAction(
  businessType: BusinessType,
  idempotencyKey: string,
): Promise<ActionResult<BusinessPurchaseResult>> {
  try {
    const session = await requirePlayer();
    const parsed = businessPurchaseSchema.safeParse({ businessType, idempotencyKey });
    if (!parsed.success) {
      return { success: false, error: parsed.error.issues[0]?.message ?? 'Invalid input' };
    }

    const playerId = session.user.playerId!;
    const cached = await idempotentAction<BusinessPurchaseResult>(playerId, idempotencyKey);
    if (cached) return { success: true, data: cached };

    const result = await runSerializableTransaction(async (tx) => {
      const player = await tx.player.findUniqueOrThrow({
        where: { id: playerId },
        include: { season: true },
      });
      if (player.season.status !== 'ACTIVE') throw new SeasonInactiveError();
      assertPlayerCanPerformAction(player);

      const ownedCount = await tx.business.count({ where: { playerId } });
      const err = validatePurchase(player, ownedCount, parsed.data.businessType);
      if (err) throw new GameplayError('INVALID_QUANTITY', err);

      const price = businessPurchasePrice(parsed.data.businessType);
      const sequence = await nextBusinessSequence(tx, playerId, parsed.data.businessType);
      const name = businessNameForPurchase(parsed.data.businessType, sequence);

      const business = await tx.business.create({
        data: {
          playerId,
          businessType: parsed.data.businessType,
          districtId: player.districtId,
          name,
          purchasePrice: price,
        },
      });

      const updated = await tx.player.update({
        where: { id: playerId },
        data: {
          cash: player.cash - price,
          businesses: { increment: 1 },
        },
      });

      const allBusinesses = await tx.business.findMany({
        where: { playerId },
        select: { purchasePrice: true, assignedWorkers: true },
      });
      const canonicalNetWorth = calculatePlayerCanonicalNetWorthSync(updated, allBusinesses);

      const resultData: BusinessPurchaseResult = {
        businessId: business.id,
        businessType: parsed.data.businessType,
        businessName: name,
        purchasePrice: price,
        newCash: updated.cash,
        streetWorkers: updated.prostitutes,
        canonicalNetWorth,
      };

      await tx.gameAction.create({
        data: {
          playerId,
          seasonId: player.seasonId,
          actionType: 'BUSINESS_PURCHASE',
          idempotencyKey,
          requestPayload: { businessType: parsed.data.businessType } as object,
          resultPayload: resultData as object,
        },
      });

      await tx.economicAuditLog.create({
        data: {
          playerId,
          userId: session.user.id,
          eventType: 'BUSINESS_PURCHASE',
          source: 'business',
          beforeState: snapshotPlayerState(player) as object,
          delta: { cash: -price, businesses: 1 },
          afterState: snapshotPlayerState(updated) as object,
          metadata: { businessId: business.id, businessType, price, name },
        },
      });

      return resultData;
    });

    return { success: true, data: result };
  } catch (error) {
    console.error('Business purchase error:', error);
    return { success: false, error: toUserMessage(error) };
  }
}

export async function assignBusinessWorkersAction(
  businessId: string,
  quantity: number,
  idempotencyKey: string,
): Promise<ActionResult<BusinessWorkerResult>> {
  return mutateBusinessWorkers(businessId, quantity, idempotencyKey, 'ASSIGN');
}

export async function removeBusinessWorkersAction(
  businessId: string,
  quantity: number,
  idempotencyKey: string,
): Promise<ActionResult<BusinessWorkerResult>> {
  return mutateBusinessWorkers(businessId, quantity, idempotencyKey, 'REMOVE');
}

async function mutateBusinessWorkers(
  businessId: string,
  quantity: number,
  idempotencyKey: string,
  mode: 'ASSIGN' | 'REMOVE',
): Promise<ActionResult<BusinessWorkerResult>> {
  try {
    const session = await requirePlayer();
    const parsed = businessWorkerSchema.safeParse({ businessId, quantity, idempotencyKey });
    if (!parsed.success) {
      return { success: false, error: parsed.error.issues[0]?.message ?? 'Invalid input' };
    }

    const playerId = session.user.playerId!;
    const actionType = mode === 'ASSIGN' ? 'BUSINESS_ASSIGN_WORKERS' : 'BUSINESS_REMOVE_WORKERS';
    const cached = await idempotentAction<BusinessWorkerResult>(playerId, idempotencyKey);
    if (cached) return { success: true, data: cached };

    const result = await runSerializableTransaction(async (tx) => {
      const player = await tx.player.findUniqueOrThrow({
        where: { id: playerId },
        include: { season: true },
      });
      if (player.season.status !== 'ACTIVE') throw new SeasonInactiveError();
      assertPlayerCanPerformAction(player);

      const business = await tx.business.findFirst({
        where: { id: parsed.data.businessId, playerId },
      });
      if (!business) throw new GameplayError('INVALID_TARGET', 'Business not found.');

      await settleBusinessInTransaction(tx, business.id);

      const fresh = await tx.business.findUniqueOrThrow({ where: { id: business.id } });
      const qty = parsed.data.quantity;

      if (mode === 'ASSIGN') {
        const err = validateAssignWorkers(player.prostitutes, qty);
        if (err) throw new GameplayError('INVALID_QUANTITY', err);
      } else {
        const err = validateRemoveWorkers(fresh.assignedWorkers, qty);
        if (err) throw new GameplayError('INVALID_QUANTITY', err);
      }

      const playerDelta = mode === 'ASSIGN' ? -qty : qty;
      const businessDelta = mode === 'ASSIGN' ? qty : -qty;

      const updatedPlayer = await tx.player.update({
        where: { id: playerId },
        data: { prostitutes: player.prostitutes + playerDelta },
      });

      const updatedBusiness = await tx.business.update({
        where: { id: business.id },
        data: { assignedWorkers: fresh.assignedWorkers + businessDelta },
      });

      const allBusinesses = await tx.business.findMany({
        where: { playerId },
        select: { purchasePrice: true, assignedWorkers: true },
      });
      const canonicalNetWorth = calculatePlayerCanonicalNetWorthSync(updatedPlayer, allBusinesses);

      const resultData: BusinessWorkerResult = {
        businessId: business.id,
        quantity: qty,
        assignedWorkers: updatedBusiness.assignedWorkers,
        newCash: updatedPlayer.cash,
        streetWorkers: updatedPlayer.prostitutes,
        canonicalNetWorth,
      };

      await tx.gameAction.create({
        data: {
          playerId,
          seasonId: player.seasonId,
          actionType,
          idempotencyKey,
          requestPayload: { businessId, quantity: qty, mode } as object,
          resultPayload: resultData as object,
        },
      });

      return resultData;
    });

    return { success: true, data: result };
  } catch (error) {
    console.error('Business worker mutation error:', error);
    return { success: false, error: toUserMessage(error) };
  }
}

export async function collectBusinessSafeAction(
  businessId: string,
  idempotencyKey: string,
): Promise<ActionResult<BusinessCollectResult>> {
  try {
    const session = await requirePlayer();
    const parsed = businessCollectSchema.safeParse({ businessId, idempotencyKey });
    if (!parsed.success) {
      return { success: false, error: parsed.error.issues[0]?.message ?? 'Invalid input' };
    }

    const playerId = session.user.playerId!;
    const cached = await idempotentAction<BusinessCollectResult>(playerId, idempotencyKey);
    if (cached) return { success: true, data: cached };

    const result = await runSerializableTransaction(async (tx) => {
      const player = await tx.player.findUniqueOrThrow({
        where: { id: playerId },
        include: { season: true },
      });
      if (player.season.status !== 'ACTIVE') throw new SeasonInactiveError();
      assertPlayerCanPerformAction(player);

      const business = await tx.business.findFirst({
        where: { id: parsed.data.businessId, playerId },
      });
      if (!business) throw new GameplayError('INVALID_TARGET', 'Business not found.');

      const { row: settled } = await settleBusinessInTransaction(tx, business.id);
      const collected = settled.safeCash;
      if (collected <= 0) throw new GameplayError('INVALID_QUANTITY', 'Nothing to collect.');

      await tx.business.update({
        where: { id: business.id },
        data: { safeCash: 0 },
      });

      const updated = await tx.player.update({
        where: { id: playerId },
        data: { cash: player.cash + collected },
      });

      const allBusinesses = await tx.business.findMany({
        where: { playerId },
        select: { purchasePrice: true, assignedWorkers: true },
      });
      const canonicalNetWorth = calculatePlayerCanonicalNetWorthSync(updated, allBusinesses);

      const resultData: BusinessCollectResult = {
        businessId: business.id,
        collected,
        newSafeCash: 0,
        newCash: updated.cash,
        streetWorkers: updated.prostitutes,
        canonicalNetWorth,
      };

      await tx.gameAction.create({
        data: {
          playerId,
          seasonId: player.seasonId,
          actionType: 'BUSINESS_COLLECT',
          idempotencyKey,
          requestPayload: { businessId } as object,
          resultPayload: resultData as object,
        },
      });

      await tx.economicAuditLog.create({
        data: {
          playerId,
          userId: session.user.id,
          eventType: 'BUSINESS_COLLECT',
          source: 'business',
          beforeState: snapshotPlayerState(player) as object,
          delta: { cash: collected },
          afterState: snapshotPlayerState(updated) as object,
          metadata: { businessId, collected },
        },
      });

      return resultData;
    });

    return { success: true, data: result };
  } catch (error) {
    console.error('Business collect error:', error);
    return { success: false, error: toUserMessage(error) };
  }
}

export async function storeBusinessDrugsAction(
  businessId: string,
  drug: string,
  quantity: number,
  idempotencyKey: string,
): Promise<ActionResult<BusinessDrugResult>> {
  return transferBusinessDrugs(businessId, drug, quantity, idempotencyKey, 'STORE');
}

export async function withdrawBusinessDrugsAction(
  businessId: string,
  drug: string,
  quantity: number,
  idempotencyKey: string,
): Promise<ActionResult<BusinessDrugResult>> {
  return transferBusinessDrugs(businessId, drug, quantity, idempotencyKey, 'WITHDRAW');
}

async function transferBusinessDrugs(
  businessId: string,
  drug: string,
  quantity: number,
  idempotencyKey: string,
  mode: 'STORE' | 'WITHDRAW',
): Promise<ActionResult<BusinessDrugResult>> {
  try {
    const session = await requirePlayer();
    const parsed = businessDrugTransferSchema.safeParse({
      businessId,
      drug,
      quantity,
      idempotencyKey,
    });
    if (!parsed.success) {
      return { success: false, error: parsed.error.issues[0]?.message ?? 'Invalid input' };
    }
    if (!assertBusinessDrugKey(parsed.data.drug)) {
      return { success: false, error: 'Invalid drug type.' };
    }

    const playerId = session.user.playerId!;
    const actionType = mode === 'STORE' ? 'BUSINESS_STORE_DRUGS' : 'BUSINESS_WITHDRAW_DRUGS';
    const cached = await idempotentAction<BusinessDrugResult>(playerId, idempotencyKey);
    if (cached) return { success: true, data: cached };

    const drugKey = parsed.data.drug;

    const result = await runSerializableTransaction(async (tx) => {
      const player = await tx.player.findUniqueOrThrow({
        where: { id: playerId },
        include: { season: true },
      });
      if (player.season.status !== 'ACTIVE') throw new SeasonInactiveError();
      assertPlayerCanPerformAction(player);

      const business = await tx.business.findFirst({
        where: { id: parsed.data.businessId, playerId },
      });
      if (!business) throw new GameplayError('INVALID_TARGET', 'Business not found.');

      await settleBusinessInTransaction(tx, business.id);
      const fresh = await tx.business.findUniqueOrThrow({ where: { id: business.id } });
      const rule = getBusinessTypeRule(fresh.businessType);
      const qty = parsed.data.quantity;
      const storedTotal = fresh.hash + fresh.shrooms + fresh.coke + fresh.heroin;
      const playerQty = player[drugKey];

      if (mode === 'STORE') {
        const err = validateDrugTransfer(playerQty, storedTotal, rule.drugStorageCapacity, qty);
        if (err) throw new GameplayError('INVALID_QUANTITY', err);
      } else {
        const storedQty = fresh[drugKey];
        const err = validateDrugWithdraw(storedQty, qty);
        if (err) throw new GameplayError('INVALID_QUANTITY', err);
      }

      const playerDelta = mode === 'STORE' ? -qty : qty;
      const businessDelta = mode === 'STORE' ? qty : -qty;

      const updatedPlayer = await tx.player.update({
        where: { id: playerId },
        data: { [drugKey]: playerQty + playerDelta },
      });

      const updatedBusiness = await tx.business.update({
        where: { id: business.id },
        data: { [drugKey]: fresh[drugKey] + businessDelta },
      });

      void updatedBusiness;

      const allBusinesses = await tx.business.findMany({
        where: { playerId },
        select: { purchasePrice: true, assignedWorkers: true },
      });
      const canonicalNetWorth = calculatePlayerCanonicalNetWorthSync(updatedPlayer, allBusinesses);

      const resultData: BusinessDrugResult = {
        businessId: business.id,
        drug: drugKey,
        quantity: qty,
        newCash: updatedPlayer.cash,
        streetWorkers: updatedPlayer.prostitutes,
        canonicalNetWorth,
      };

      await tx.gameAction.create({
        data: {
          playerId,
          seasonId: player.seasonId,
          actionType,
          idempotencyKey,
          requestPayload: { businessId, drug: drugKey, quantity: qty, mode } as object,
          resultPayload: resultData as object,
        },
      });

      return resultData;
    });

    return { success: true, data: result };
  } catch (error) {
    console.error('Business drug transfer error:', error);
    return { success: false, error: toUserMessage(error) };
  }
}
