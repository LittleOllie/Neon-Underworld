'use server';

import {
  shopPurchaseAction as coreShopPurchaseAction,
  shopSellAction as coreShopSellAction,
  getShopCatalog as coreGetShopCatalog,
  type ShopPurchaseResult,
  type ShopSellResult,
  type ShopCatalogEntry,
  type ShopItemKey,
} from '@core/server/actions/shop.actions';
import type { ActionResult } from '@core/server/actions/auth.actions';
import { auth } from '@local/lib/auth/config';
import { prisma } from '@core/lib/db/prisma';
import { ACTIVITY_TYPES } from '@local/config/activity-types';
import { ActivityService } from '@local/server/services/activity.service';
import { EmpireService } from '@local/server/services/empire.service';
import { finalizeLocalMutationShell } from '@local/server/services/shell-snapshot.service';
import type { WithPlayerShell } from '@local/domain/player-shell.model';
import type { CanonicalPlayerContext } from '@local/server/services/player.service';
import {
  streetDrugSaleAction as coreStreetDrugSaleAction,
  type StreetDrugSaleResult,
} from '@core/server/actions/drug-street.actions';
import { getDrugStreetPrice, type StreetDrugType } from '@core/config/game/drug-street-prices';

export type { ShopPurchaseResult, ShopSellResult, ShopCatalogEntry, ShopItemKey, StreetDrugSaleResult };

export interface ShopRecentPurchase {
  message: string;
  createdAt: Date;
}

export interface ShopPageData {
  catalog: ShopCatalogEntry[];
  cash: number;
  city: string;
  districtSlug: string;
  streetDrugPrices: Record<StreetDrugType, number>;
  inventory: {
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
    workers: number;
  };
  recentPurchases: ShopRecentPurchase[];
}

export async function getShopPageDataFromContext(
  ctx: CanonicalPlayerContext,
): Promise<ShopPageData> {
  const [catalog, activities] = await Promise.all([
    coreGetShopCatalog(),
    prisma.activity.findMany({
      where: { playerId: ctx.id, category: 'SHOP_PURCHASE' },
      orderBy: { createdAt: 'desc' },
      take: 5,
    }),
  ]);

  return {
    catalog,
    cash: ctx.cash,
    city: ctx.district.name,
    districtSlug: ctx.district.slug,
    streetDrugPrices: {
      hash: getDrugStreetPrice(ctx.district.slug, 'hash'),
      shrooms: getDrugStreetPrice(ctx.district.slug, 'shrooms'),
      coke: getDrugStreetPrice(ctx.district.slug, 'coke'),
      heroin: getDrugStreetPrice(ctx.district.slug, 'heroin'),
    },
    inventory: {
      glocks: ctx.glocks,
      uzis: ctx.uzis,
      aks: ctx.aks,
      rides: ctx.rides,
      condoms: ctx.condoms,
      hash: ctx.hash,
      beer: ctx.beer,
      shrooms: ctx.shrooms,
      coke: ctx.coke,
      heroin: ctx.heroin,
      thugs: ctx.thugs,
      workers: ctx.prostitutes,
    },
    recentPurchases: activities.map((a) => ({
      message: a.message,
      createdAt: a.createdAt,
    })),
  };
}

export async function getShopPageData(playerId: string): Promise<ShopPageData> {
  const [catalog, player, activities] = await Promise.all([
    coreGetShopCatalog(),
    prisma.player.findUniqueOrThrow({
      where: { id: playerId },
      include: { district: true },
    }),
    prisma.activity.findMany({
      where: { playerId, category: 'SHOP_PURCHASE' },
      orderBy: { createdAt: 'desc' },
      take: 5,
    }),
  ]);

  return {
    catalog,
    cash: player.cash,
    city: player.district.name,
    districtSlug: player.district.slug,
    streetDrugPrices: {
      hash: getDrugStreetPrice(player.district.slug, 'hash'),
      shrooms: getDrugStreetPrice(player.district.slug, 'shrooms'),
      coke: getDrugStreetPrice(player.district.slug, 'coke'),
      heroin: getDrugStreetPrice(player.district.slug, 'heroin'),
    },
    inventory: {
      glocks: player.glocks,
      uzis: player.uzis,
      aks: player.aks,
      rides: player.rides,
      condoms: player.condoms,
      hash: player.hash,
      beer: player.beer,
      shrooms: player.shrooms,
      coke: player.coke,
      heroin: player.heroin,
      thugs: player.thugs,
      workers: player.prostitutes,
    },
    recentPurchases: activities.map((a) => ({
      message: a.message,
      createdAt: a.createdAt,
    })),
  };
}

export async function shopPurchaseAction(
  item: ShopItemKey,
  quantity: number,
  idempotencyKey: string,
): Promise<ActionResult<WithPlayerShell<ShopPurchaseResult & { canonicalNetWorth: number }>>> {
  const result = await coreShopPurchaseAction(item, quantity, idempotencyKey);
  if (!result.success) return result;

  const session = await auth();
  const playerId = session?.user?.playerId;
  if (!playerId) return { success: false, error: 'Not authenticated' };

  await EmpireService.syncInventory(playerId);
  const updated = await prisma.player.findUniqueOrThrow({
    where: { id: playerId },
    include: { district: true, turnState: true },
  });
  const shell = await finalizeLocalMutationShell(playerId, updated, ['/shop']);

  await ActivityService.record(
    playerId,
    ACTIVITY_TYPES.SHOP_PURCHASE,
    `Purchased ${result.data.quantity}× ${result.data.item} for $${result.data.totalCost.toLocaleString()}.`,
    { shop: result.data },
  );

  return {
    success: true,
    data: {
      ...result.data,
      newNetWorth: shell.netWorth,
      canonicalNetWorth: shell.netWorth,
      shell,
    },
  };
}

export async function shopSellAction(
  item: ShopItemKey,
  quantity: number,
  idempotencyKey: string,
): Promise<ActionResult<WithPlayerShell<ShopSellResult>>> {
  const result = await coreShopSellAction(item, quantity, idempotencyKey);
  if (!result.success) return result;

  const session = await auth();
  const playerId = session?.user?.playerId;
  if (!playerId) return { success: false, error: 'Not authenticated' };

  const catalog = await coreGetShopCatalog();
  const label = catalog.find((e) => e.key === item)?.displayName ?? item;

  await EmpireService.syncInventory(playerId);
  const updated = await prisma.player.findUniqueOrThrow({
    where: { id: playerId },
    include: { district: true, turnState: true },
  });
  const shell = await finalizeLocalMutationShell(playerId, updated, ['/shop']);

  await ActivityService.record(
    playerId,
    ACTIVITY_TYPES.SHOP_SELL,
    `Sold ${result.data.quantity}× ${label} to the shop for $${result.data.totalPayout.toLocaleString()}.`,
    { shopSell: result.data },
  );

  return {
    success: true,
    data: {
      ...result.data,
      newNetWorth: shell.netWorth,
      canonicalNetWorth: shell.netWorth,
      shell,
    },
  };
}

export async function streetDrugSaleAction(
  drug: StreetDrugType,
  quantity: number,
  idempotencyKey: string,
): Promise<ActionResult<WithPlayerShell<StreetDrugSaleResult>>> {
  const result = await coreStreetDrugSaleAction(drug, quantity, idempotencyKey);
  if (!result.success) return result;

  const session = await auth();
  const playerId = session?.user?.playerId;
  if (!playerId) return { success: false, error: 'Not authenticated' };

  await EmpireService.syncInventory(playerId);
  const updated = await prisma.player.findUniqueOrThrow({
    where: { id: playerId },
    include: { district: true, turnState: true },
  });
  const shell = await finalizeLocalMutationShell(playerId, updated, ['/shop']);

  await ActivityService.record(
    playerId,
    ACTIVITY_TYPES.SHOP_SELL,
    `Street sale: ${result.data.quantity}× ${drug} for $${result.data.totalPayout.toLocaleString()} in ${updated.district.name}.`,
    { streetDrugSale: result.data },
  );

  return {
    success: true,
    data: {
      ...result.data,
      newNetWorth: shell.netWorth,
      shell,
    },
  };
}
