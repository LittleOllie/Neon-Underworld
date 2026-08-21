'use server';

import { prisma } from '@/lib/db/prisma';
import { requirePlayer } from '@/lib/auth/session';
import { shopPurchaseSchema, shopSellSchema, shopCartCheckoutSchema } from '@/lib/validation/schemas';
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
import { assertGameplaySeasonActive } from '@/lib/game-engine/season-guard';
import { throwIfValidationMessage, toUserMessage } from '@/lib/game-engine/gameplay-errors';
import { assertPlayerCanPerformAction } from '@/lib/game-engine/player-action-guard';
import { runSerializableTransaction } from '@/lib/db/serializable-transaction';
import { GameplayError } from '@/lib/game-engine/gameplay-errors';
import {
  buildShopCartPlayerUpdate,
  shopCartAnalyticsFlags,
  validateShopCartOrder,
  type ResolvedShopCartLine,
  type ShopCartLineInput,
  type ShopCartLineKey,
} from '@/lib/game-engine/shop-cart';
import type { ActionResult } from './auth.actions';

export type { ShopCartLineKey, ShopCartLineInput, ResolvedShopCartLine };

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

export interface ShopCartCheckoutResult {
  lines: Array<{
    itemId: ShopCartLineKey;
    displayName: string;
    quantity: number;
    unitPrice: number;
    lineCost: number;
    newOwnedQuantity: number;
  }>;
  totalCost: number;
  totalUnits: number;
  itemTypeCount: number;
  newCash: number;
  newNetWorth: number;
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

    const result = await runSerializableTransaction(async (tx) => {
      const player = await tx.player.findUniqueOrThrow({
        where: { id: playerId },
        include: { season: true },
      });

      assertGameplaySeasonActive(player.season);

      assertPlayerCanPerformAction(player);

      throwIfValidationMessage(
        validateShopPurchaseContext(player, parsed.data.item, parsed.data.quantity),
      );

      const rule = getCityShopItem(parsed.data.item)!;
      const unitPrice = rule.shopPrice;
      const totalCost = unitPrice * parsed.data.quantity;
      const field = rule.field;

      const updatedCount = await tx.player.updateMany({
        where: { id: playerId, cash: { gte: totalCost } },
        data: {
          cash: { decrement: totalCost },
          [field]: { increment: parsed.data.quantity },
        },
      });
      if (updatedCount.count === 0) {
        throw new GameplayError('INSUFFICIENT_CASH', 'Insufficient cash.');
      }

      const updatedPlayer = await tx.player.findUniqueOrThrow({ where: { id: playerId } });
      const newCash = updatedPlayer.cash;
      const newQty = updatedPlayer[field] as number;
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
    });

    return { success: true, data: result };
  } catch (error) {
    console.error('Shop purchase error:', error);
    return { success: false, error: toUserMessage(error) };
  }
}

export async function shopCartCheckoutAction(
  lines: ShopCartLineInput[],
  idempotencyKey: string,
): Promise<ActionResult<ShopCartCheckoutResult>> {
  try {
    const session = await requirePlayer();
    const parsed = shopCartCheckoutSchema.safeParse({ lines, idempotencyKey });
    if (!parsed.success) {
      return { success: false, error: parsed.error.issues[0]?.message ?? 'Invalid input' };
    }

    const playerId = session.user.playerId!;

    const existing = await prisma.gameAction.findUnique({
      where: { playerId_idempotencyKey: { playerId, idempotencyKey } },
    });
    if (existing?.resultPayload) {
      return { success: true, data: existing.resultPayload as unknown as ShopCartCheckoutResult };
    }

    const result = await runSerializableTransaction(async (tx) => {
      const player = await tx.player.findUniqueOrThrow({
        where: { id: playerId },
        include: { season: true },
      });

      assertGameplaySeasonActive(player.season);
      assertPlayerCanPerformAction(player);

      const validation = validateShopCartOrder(player, parsed.data.lines);
      if (!validation.ok) {
        throw new GameplayError('INVALID_QUANTITY', validation.error);
      }

      const { lines: resolvedLines, totalCost } = validation;
      const updateData = buildShopCartPlayerUpdate(resolvedLines, totalCost);

      const updatedCount = await tx.player.updateMany({
        where: { id: playerId, cash: { gte: totalCost } },
        data: updateData,
      });
      if (updatedCount.count === 0) {
        throw new GameplayError(
          'INSUFFICIENT_CASH',
          `Your order costs $${totalCost.toLocaleString()}. You currently have $${player.cash.toLocaleString()}.`,
        );
      }

      const updatedPlayer = await tx.player.findUniqueOrThrow({ where: { id: playerId } });
      const newCash = updatedPlayer.cash;
      const newNetWorth = calculateNetWorth(playerToResources(updatedPlayer));

      const resultLines = resolvedLines.map((line) => {
        const owned =
          line.inventoryField != null
            ? (updatedPlayer[line.inventoryField as keyof typeof updatedPlayer] as number)
            : 0;
        return {
          itemId: line.itemId,
          displayName: line.displayName,
          quantity: line.quantity,
          unitPrice: line.unitPrice,
          lineCost: line.lineCost,
          newOwnedQuantity: owned,
        };
      });

      const analytics = shopCartAnalyticsFlags(resolvedLines);
      const resultData: ShopCartCheckoutResult = {
        lines: resultLines,
        totalCost,
        totalUnits: analytics.totalUnits,
        itemTypeCount: analytics.itemTypeCount,
        newCash,
        newNetWorth,
      };

      await tx.gameAction.create({
        data: {
          playerId,
          seasonId: player.seasonId,
          actionType: 'SHOP_CART_CHECKOUT',
          idempotencyKey,
          requestPayload: parsed.data as object,
          resultPayload: resultData as object,
          turnsSpent: 0,
        },
      });

      const delta: Record<string, number> = { cash: -totalCost };
      for (const line of resolvedLines) {
        if (line.inventoryField) {
          delta[line.inventoryField as string] = line.quantity;
        }
      }

      await tx.economicAuditLog.create({
        data: {
          playerId,
          userId: session.user.id,
          eventType: 'SHOP_CART_CHECKOUT',
          source: 'shop',
          beforeState: snapshotPlayerState(player) as object,
          delta,
          afterState: snapshotPlayerState(updatedPlayer) as object,
          metadata: {
            idempotencyKey,
            totalCost,
            lines: resolvedLines.map((line) => ({
              itemId: line.itemId,
              quantity: line.quantity,
              lineCost: line.lineCost,
            })),
          },
        },
      });

      return resultData;
    });

    return { success: true, data: result };
  } catch (error) {
    console.error('Shop cart checkout error:', error);
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

    const result = await runSerializableTransaction(async (tx) => {
      const player = await tx.player.findUniqueOrThrow({
        where: { id: playerId },
        include: { season: true },
      });

      assertGameplaySeasonActive(player.season);

      assertPlayerCanPerformAction(player);

      throwIfValidationMessage(
        validateShopSellContext(player, parsed.data.item, parsed.data.quantity),
      );

      const rule = getCityShopItem(parsed.data.item)!;
      const unitPrice = getCityShopSellPrice(parsed.data.item);
      const totalPayout = unitPrice * parsed.data.quantity;
      const field = rule.field;

      const updatedCount = await tx.player.updateMany({
        where: { id: playerId, [field]: { gte: parsed.data.quantity } },
        data: {
          cash: { increment: totalPayout },
          [field]: { decrement: parsed.data.quantity },
        },
      });
      if (updatedCount.count === 0) {
        throw new GameplayError('INVALID_QUANTITY', 'You do not have enough of this item to sell.');
      }

      const updatedPlayer = await tx.player.findUniqueOrThrow({ where: { id: playerId } });
      const newQty = updatedPlayer[field] as number;
      const newCash = updatedPlayer.cash;

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
    });

    return { success: true, data: result };
  } catch (error) {
    console.error('Shop sell error:', error);
    return { success: false, error: toUserMessage(error) };
  }
}
