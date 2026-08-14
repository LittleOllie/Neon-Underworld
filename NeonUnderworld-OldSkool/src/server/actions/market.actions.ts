'use server';

import { MarketService } from '@core/server/services/market.service';
import { MARKET_RULES, marketItemDisplayName, type MarketDurationMinutes, type MarketFilterCategory, type MarketTradableItemKey } from '@core/config/game/market-rules';
import { readPlayerItemQuantity } from '@core/lib/game-engine/market-inventory';
import type { ActionResult } from '@core/server/actions/auth.actions';
import { auth } from '@local/lib/auth/config';
import { assertSessionMatchesPlayer } from '@local/lib/auth/session-player';
import { prisma } from '@core/lib/db/prisma';
import { GameplayError, toUserMessage } from '@core/lib/game-engine/gameplay-errors';
import { ACTIVITY_TYPES } from '@local/config/activity-types';
import { ActivityService } from '@local/server/services/activity.service';
import {
  revalidatePlayerGameplayCache,
  revalidatePlayersGameplayCache,
} from '@local/server/services/gameplay-cache';
import {
  revalidateAfterLocalMutation,
  buildShellSnapshotFromPlayer,
} from '@local/server/services/shell-snapshot.service';
import type { WithPlayerShell } from '@local/domain/player-shell.model';
import type { CanonicalPlayerContext } from '@local/server/services/player.service';
import { isRoutePrefetch } from '@local/lib/is-route-prefetch';

export type MarketMutationResult<T> = T & { marketPage: MarketPageData };

async function loadMarketPageForPlayer(
  playerId: string,
  filter: MarketFilter = 'all',
): Promise<MarketPageData> {
  await settleMarketAndRefreshCaches();
  const player = await prisma.player.findUniqueOrThrow({ where: { id: playerId } });
  const settlementOpt = { skipSettlement: true as const };
  const [listings, myAuctions] = await Promise.all([
    MarketService.getBrowseListings(filter, settlementOpt),
    MarketService.getMyAuctions(playerId, settlementOpt),
  ]);
  const ctx = player as unknown as CanonicalPlayerContext;
  const tradableInventory = MARKET_RULES.tradableItemKeys
    .map((key) => ({
      key,
      name: marketItemDisplayName(key),
      quantity: readPlayerItemQuantity(ctx, key),
    }))
    .filter((i) => i.quantity > 0);

  return {
    cash: player.cash,
    listings,
    myAuctions,
    tradableInventory,
    durations: MARKET_RULES.allowedDurationMinutes,
    minStartingPrice: MARKET_RULES.minStartingPrice,
  };
}

async function settleMarketAndRefreshCaches(): Promise<void> {
  const result = await MarketService.settleExpired();
  if (result.affectedPlayerIds.length > 0) {
    await revalidatePlayersGameplayCache(result.affectedPlayerIds);
  }
}

export type MarketFilter = MarketFilterCategory | 'all';

export interface MarketListingCard {
  id: string;
  itemKey: string;
  itemName: string;
  quantity: number;
  startingPrice: number;
  currentBid: number | null;
  minNextBid: number;
  endsAt: string;
  sellerAlias: string;
}

export interface MarketPageData {
  cash: number;
  listings: MarketListingCard[];
  myAuctions: Awaited<ReturnType<typeof MarketService.getMyAuctions>>;
  tradableInventory: Array<{ key: MarketTradableItemKey; name: string; quantity: number }>;
  durations: readonly MarketDurationMinutes[];
  minStartingPrice: number;
}

export async function getMarketPageDataFromContext(
  ctx: CanonicalPlayerContext,
  filter: MarketFilter = 'all',
): Promise<MarketPageData> {
  await assertSessionMatchesPlayer(ctx.id);
  const skipSettlement = await isRoutePrefetch();
  if (!skipSettlement) {
    await settleMarketAndRefreshCaches();
  }
  const settlementOpt = { skipSettlement: true as const };
  const [listings, myAuctions] = await Promise.all([
    MarketService.getBrowseListings(filter, settlementOpt),
    MarketService.getMyAuctions(ctx.id, settlementOpt),
  ]);

  const tradableInventory = MARKET_RULES.tradableItemKeys
    .map((key) => ({
      key,
      name: marketItemDisplayName(key),
      quantity: readPlayerItemQuantity(ctx, key),
    }))
    .filter((i) => i.quantity > 0);

  return {
    cash: ctx.cash,
    listings,
    myAuctions,
    tradableInventory,
    durations: MARKET_RULES.allowedDurationMinutes,
    minStartingPrice: MARKET_RULES.minStartingPrice,
  };
}

export async function createMarketListingAction(
  itemKey: string,
  quantity: number,
  startingPrice: number,
  durationMinutes: MarketDurationMinutes,
  idempotencyKey: string,
): Promise<ActionResult<WithPlayerShell<MarketMutationResult<{ listingId: string }>>>> {
  try {
    const session = await auth();
    const playerId = session?.user?.playerId;
    if (!playerId) return { success: false, error: 'Not authenticated' };

    const result = await MarketService.createListing(
      playerId,
      itemKey,
      quantity,
      startingPrice,
      durationMinutes,
      idempotencyKey,
    );

    await ActivityService.record(
      playerId,
      ACTIVITY_TYPES.MARKET_LISTING,
      `You listed ${quantity} ${marketItemDisplayName(itemKey)} on the Market.`,
      { listingId: result.listingId, itemKey, quantity, startingPrice },
    );

    const updated = await prisma.player.findUniqueOrThrow({
      where: { id: playerId },
      include: { district: true, turnState: true },
    });
    const marketPage = await loadMarketPageForPlayer(playerId);
    const shell = await buildShellSnapshotFromPlayer(updated);
    revalidateAfterLocalMutation(playerId, updated.seasonId, ['/market']);

    return { success: true, data: { listingId: result.listingId, shell, marketPage } };
  } catch (error) {
    return { success: false, error: toUserMessage(error) };
  }
}

export async function placeMarketBidAction(
  listingId: string,
  amount: number,
  idempotencyKey: string,
): Promise<ActionResult<WithPlayerShell<MarketMutationResult<{ bidId: string; amount: number }>>>> {
  try {
    const session = await auth();
    const playerId = session?.user?.playerId;
    if (!playerId) return { success: false, error: 'Not authenticated' };

    const listing = await prisma.marketListing.findUnique({
      where: { id: listingId },
      include: { seller: { select: { alias: true } } },
    });
    if (!listing) throw new GameplayError('MARKET_LISTING_ENDED');

    const previousBidderId = listing.highestBidderId;
    const result = await MarketService.placeBid(playerId, listingId, amount, idempotencyKey);

    await ActivityService.record(
      playerId,
      ACTIVITY_TYPES.MARKET_BID,
      `You bid $${amount.toLocaleString()} on ${listing.quantity}× ${marketItemDisplayName(listing.itemKey)}.`,
      { listingId, amount },
    );

    if (previousBidderId && previousBidderId !== playerId) {
      await ActivityService.record(
        previousBidderId,
        ACTIVITY_TYPES.MARKET_BID,
        `You were outbid on ${listing.quantity}× ${marketItemDisplayName(listing.itemKey)}.`,
        { listingId, amount },
      );
    }

    await settleMarketAndRefreshCaches();
    if (previousBidderId && previousBidderId !== playerId) {
      const previous = await prisma.player.findUnique({
        where: { id: previousBidderId },
        select: { seasonId: true },
      });
      if (previous) revalidatePlayerGameplayCache(previousBidderId, previous.seasonId);
    }

    const updated = await prisma.player.findUniqueOrThrow({
      where: { id: playerId },
      include: { district: true, turnState: true },
    });
    const marketPage = await loadMarketPageForPlayer(playerId);
    const shell = await buildShellSnapshotFromPlayer(updated);
    revalidateAfterLocalMutation(playerId, updated.seasonId, ['/market']);

    return { success: true, data: { bidId: result.bidId, amount: result.amount, shell, marketPage } };
  } catch (error) {
    return { success: false, error: toUserMessage(error) };
  }
}
