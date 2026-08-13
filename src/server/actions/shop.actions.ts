'use server';

import { prisma } from '@/lib/db/prisma';
import { requirePlayer } from '@/lib/auth/session';
import { shopPurchaseSchema, shopSellSchema } from '@/lib/validation/schemas';
import {
  CITY_SHOP_ITEMS,
  getCityShopItem,
  getCityShopSellPrice,
  isCityShopItem,
  isPersonnelItem,
  SHOP_CATEGORY_LABELS,
  SHOP_CATEGORY_ORDER,
  type ShopCategory,
  type ShopItemKey,
} from '@/config/game/shop-rules';
import { calculateNetWorth } from '@/lib/game-engine/net-worth';
import { calculateCanonicalNetWorthFromPlayer } from '@/lib/game-engine/canonical-net-worth';
import { playerToResources, snapshotPlayerState } from '@/lib/game-engine/state';
import { SeasonInactiveError } from '@/lib/game-engine/errors';
import { throwIfValidationMessage, toUserMessage } from '@/lib/game-engine/gameplay-errors';
import { assertPlayerCanPerformAction } from '@/lib/game-engine/player-action-guard';
import { OfflineProtectionService } from '@/server/services/offline-protection.service';
import type { ActionResult } from './auth.actions';

export type { ShopItemKey };

export interface ShopCatalogEntry {
  key: ShopItemKey;
  displayName: string;
  category: ShopCategory;
  categoryLabel: string;
  unitPrice: number;
  sellUnitPrice: number;
  purpose: string;
  contributesToNetWorth: boolean;
}

export interface ShopSellResult {
  item: ShopItemKey;
  quantity: number;
  unitPrice: number;
  totalPayout: number;
  newCash: number;
  newNetWorth: number;
  newOwnedQuantity: number;
  canonicalNetWorth: number;
}

export interface ShopPurchaseResult {
  item: ShopItemKey;
  quantity: number;
  unitPrice: number;
  totalCost: number;
  newCash: number;
  newNetWorth: number;
  newOwnedQuantity: number;
}

export interface ShopPageInventory {
  glocks: number;
  uzis: number;
  aks: number;
  rides: number;
  condoms: number;
  hash: number;
  beer: number;
  shrooms: number;
  coke: number;
  heroin: number;
  thugs: number;
}

export async function getShopCatalog(): Promise<ShopCatalogEntry[]> {
  return CITY_SHOP_ITEMS.map((entry) => ({
    key: entry.key,
    displayName: entry.displayName,
    category: entry.category,
    categoryLabel: SHOP_CATEGORY_LABELS[entry.category],
    unitPrice: entry.shopPrice,
    sellUnitPrice: getCityShopSellPrice(entry.key),
    purpose: entry.purpose,
    contributesToNetWorth: entry.contributesToNetWorth,
  }));
}

function validateShopPurchaseContext(
  player: {
    cash: number;
    lifeStatus: string;
    travelling: boolean;
  },
  itemKey: string,
  quantity: number,
): string | null {
  if (isPersonnelItem(itemKey)) {
    return 'Workers and Thugs cannot be purchased from the City Shop. Use Scout to recruit personnel.';
  }
  if (!isCityShopItem(itemKey)) {
    return 'This item is not sold by the City Shop.';
  }
  const rule = getCityShopItem(itemKey);
  if (!rule || !rule.cityShop) {
    return 'This item is not sold by the City Shop.';
  }
  if (!Number.isInteger(quantity) || quantity < 1) {
    return 'Quantity must be a positive whole number.';
  }
  if (player.lifeStatus !== 'ACTIVE') {
    return 'Purchases unavailable in your current status.';
  }
  if (player.travelling) {
    return 'Purchases unavailable while travelling.';
  }
  const totalCost = rule.shopPrice * quantity;
  if (totalCost > player.cash) {
    return 'Insufficient cash.';
  }
  if (totalCost < 0 || !Number.isFinite(totalCost)) {
    return 'Invalid purchase total.';
  }
  return null;
}

export async function shopPurchaseAction(
  item: string,
  quantity: number,
  idempotencyKey: string,
): Promise<ActionResult<ShopPurchaseResult>> {
  try {
    const session = await requirePlayer();
    const parsed = shopPurchaseSchema.safeParse({ item, quantity, idempotencyKey });
    if (!parsed.success) {
      return { success: false, error: parsed.error.issues[0]?.message ?? 'Invalid input' };
    }

    if (isPersonnelItem(parsed.data.item)) {
      return {
        success: false,
        error: 'Workers and Thugs cannot be purchased from the City Shop. Use Scout to recruit personnel.',
      };
    }

    const playerId = session.user.playerId!;

    const existing = await prisma.gameAction.findUnique({
      where: { playerId_idempotencyKey: { playerId, idempotencyKey } },
    });
    if (existing?.resultPayload) {
      return { success: true, data: existing.resultPayload as unknown as ShopPurchaseResult };
    }

    const result = await prisma.$transaction(async (tx) => {
      const player = await tx.player.findUniqueOrThrow({
        where: { id: playerId },
        include: { season: true },
      });

      if (player.season.status !== 'ACTIVE') throw new SeasonInactiveError();

      assertPlayerCanPerformAction(player);
      await OfflineProtectionService.resetProtectionCycleInTx(tx, playerId);

      throwIfValidationMessage(
        validateShopPurchaseContext(player, parsed.data.item, parsed.data.quantity),
      );

      const rule = getCityShopItem(parsed.data.item)!;
      const unitPrice = rule.shopPrice;
      const totalCost = unitPrice * parsed.data.quantity;

      const newCash = player.cash - totalCost;
      const field = rule.field;
      const currentQty = player[field] as number;
      const newQty = currentQty + parsed.data.quantity;

      const updatedPlayer = await tx.player.update({
        where: { id: playerId },
        data: { cash: newCash, [field]: newQty },
      });

      const newNetWorth = calculateNetWorth(playerToResources(updatedPlayer));

      const resultData: ShopPurchaseResult = {
        item: parsed.data.item,
        quantity: parsed.data.quantity,
        unitPrice,
        totalCost,
        newCash,
        newNetWorth,
        newOwnedQuantity: newQty,
      };

      await tx.gameAction.create({
        data: {
          playerId,
          seasonId: player.seasonId,
          actionType: 'SHOP_PURCHASE',
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
          eventType: 'SHOP_PURCHASE',
          source: 'shop',
          beforeState: snapshotPlayerState(player) as object,
          delta: { cash: -totalCost, [field]: parsed.data.quantity },
          afterState: snapshotPlayerState(updatedPlayer) as object,
          metadata: { idempotencyKey, item: parsed.data.item, unitPrice, totalCost },
        },
      });

      return resultData;
    }, { isolationLevel: 'Serializable' });

    return { success: true, data: result };
  } catch (error) {
    console.error('Shop purchase error:', error);
    return { success: false, error: toUserMessage(error) };
  }
}

function validateShopSellContext(
  player: {
    cash: number;
    lifeStatus: string;
    travelling: boolean;
    glocks: number;
    uzis: number;
    aks: number;
    rides: number;
    condoms: number;
    hash: number;
    beer: number;
    shrooms: number;
    coke: number;
    heroin: number;
  },
  itemKey: string,
  quantity: number,
): string | null {
  if (isPersonnelItem(itemKey)) {
    return 'Workers and Thugs cannot be sold to the City Shop.';
  }
  if (!isCityShopItem(itemKey)) {
    return 'This item cannot be sold to the City Shop.';
  }
  const rule = getCityShopItem(itemKey);
  if (!rule || !rule.cityShop) {
    return 'This item cannot be sold to the City Shop.';
  }
  if (!Number.isInteger(quantity) || quantity < 1) {
    return 'Quantity must be a positive whole number.';
  }
  if (player.lifeStatus !== 'ACTIVE') {
    return 'Sales unavailable in your current status.';
  }
  if (player.travelling) {
    return 'Sales unavailable while travelling.';
  }

  const owned = player[rule.field];
  if (owned <= 0) {
    return `You have no ${rule.displayName} to sell.`;
  }
  if (quantity > owned) {
    return `You don't own enough ${rule.displayName}.`;
  }

  const unitPrice = getCityShopSellPrice(itemKey);
  const totalPayout = unitPrice * quantity;
  if (totalPayout <= 0 || !Number.isFinite(totalPayout)) {
    return 'Invalid sale total.';
  }
  if (totalPayout > Number.MAX_SAFE_INTEGER - player.cash) {
    return 'Sale would exceed safe cash limits.';
  }

  return null;
}

export async function shopSellAction(
  item: string,
  quantity: number,
  idempotencyKey: string,
): Promise<ActionResult<ShopSellResult>> {
  try {
    const session = await requirePlayer();
    const parsed = shopSellSchema.safeParse({ item, quantity, idempotencyKey });
    if (!parsed.success) {
      return { success: false, error: parsed.error.issues[0]?.message ?? 'Invalid input' };
    }

    if (isPersonnelItem(parsed.data.item)) {
      return {
        success: false,
        error: 'Workers and Thugs cannot be sold to the City Shop.',
      };
    }

    const playerId = session.user.playerId!;

    const existing = await prisma.gameAction.findUnique({
      where: { playerId_idempotencyKey: { playerId, idempotencyKey } },
    });
    if (existing?.resultPayload) {
      return { success: true, data: existing.resultPayload as unknown as ShopSellResult };
    }

    const result = await prisma.$transaction(async (tx) => {
      const player = await tx.player.findUniqueOrThrow({
        where: { id: playerId },
        include: { season: true },
      });

      if (player.season.status !== 'ACTIVE') throw new SeasonInactiveError();

      assertPlayerCanPerformAction(player);
      await OfflineProtectionService.resetProtectionCycleInTx(tx, playerId);

      throwIfValidationMessage(
        validateShopSellContext(player, parsed.data.item, parsed.data.quantity),
      );

      const rule = getCityShopItem(parsed.data.item)!;
      const unitPrice = getCityShopSellPrice(parsed.data.item);
      const totalPayout = unitPrice * parsed.data.quantity;
      const owned = player[rule.field] as number;
      const newQty = owned - parsed.data.quantity;
      const newCash = player.cash + totalPayout;

      const updatedPlayer = await tx.player.update({
        where: { id: playerId },
        data: { cash: newCash, [rule.field]: newQty },
      });

      const newNetWorth = calculateNetWorth(playerToResources(updatedPlayer));
      const canonicalNetWorth = calculateCanonicalNetWorthFromPlayer(updatedPlayer);

      const resultData: ShopSellResult = {
        item: parsed.data.item,
        quantity: parsed.data.quantity,
        unitPrice,
        totalPayout,
        newCash,
        newNetWorth,
        newOwnedQuantity: newQty,
        canonicalNetWorth,
      };

      await tx.gameAction.create({
        data: {
          playerId,
          seasonId: player.seasonId,
          actionType: 'SHOP_SELL',
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
          eventType: 'SHOP_SELL',
          source: 'shop',
          beforeState: snapshotPlayerState(player) as object,
          delta: { cash: totalPayout, [rule.field]: -parsed.data.quantity },
          afterState: snapshotPlayerState(updatedPlayer) as object,
          metadata: { idempotencyKey, item: parsed.data.item, unitPrice, totalPayout },
        },
      });

      return resultData;
    }, { isolationLevel: 'Serializable' });

    return { success: true, data: result };
  } catch (error) {
    console.error('Shop sell error:', error);
    return { success: false, error: toUserMessage(error) };
  }
}
