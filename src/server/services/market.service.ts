import { prisma } from '@/lib/db/prisma';
import { runSerializableTransaction } from '@/lib/db/serializable-transaction';
import type { Prisma } from '@prisma/client';
import {
  MARKET_RULES,
  isMarketTradableItem,
  listingMatchesMarketFilter,
  marketItemDisplayName,
  minimumNextBid,
  type MarketDurationMinutes,
  type MarketFilterCategory,
  type MarketTradableItemKey,
} from '@/config/game/market-rules';
import { readPlayerItemQuantity, playerItemIncrement } from '@/lib/game-engine/market-inventory';
import { GameplayError } from '@/lib/game-engine/gameplay-errors';
import { assertPlayerCanPerformAction } from '@/lib/game-engine/player-action-guard';

type Tx = Prisma.TransactionClient;

type PlayerInventory = {
  id: string;
  cash: number;
  prostitutes: number;
  thugs: number;
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
};

async function adjustPlayerItem(
  tx: Tx,
  playerId: string,
  itemKey: MarketTradableItemKey,
  delta: number,
): Promise<void> {
  if (!isMarketTradableItem(itemKey)) throw new GameplayError('MARKET_ITEM_NOT_TRADABLE');
  const player = await tx.player.findUniqueOrThrow({ where: { id: playerId } });
  const current = readPlayerItemQuantity(player, itemKey);
  const next = current + delta;
  if (next < 0) throw new GameplayError('MARKET_INSUFFICIENT_QUANTITY');
  await tx.player.update({
    where: { id: playerId },
    data: playerItemIncrement(itemKey, delta) as Prisma.PlayerUpdateInput,
  });
}

export interface MarketSettlementResult {
  settledCount: number;
  affectedPlayerIds: string[];
}

export async function settleExpiredMarketListings(
  now = new Date(),
  maxBatches = 10,
): Promise<MarketSettlementResult> {
  let settledCount = 0;
  const affectedPlayerIds = new Set<string>();

  for (let batch = 0; batch < maxBatches; batch++) {
    const expired = await prisma.marketListing.findMany({
      where: { status: 'ACTIVE', endsAt: { lte: now } },
      take: 50,
    });
    if (expired.length === 0) break;

    for (const listing of expired) {
      await prisma.$transaction(async (tx) => {
        const did = await settleListingTx(tx, listing.id, now);
        if (did) {
          settledCount++;
          affectedPlayerIds.add(listing.sellerId);
          if (listing.highestBidderId) affectedPlayerIds.add(listing.highestBidderId);
        }
      });
    }

    if (expired.length < 50) break;
  }

  return { settledCount, affectedPlayerIds: [...affectedPlayerIds] };
}

async function settleListingTx(tx: Tx, listingId: string, now: Date): Promise<boolean> {
  const listing = await tx.marketListing.findUnique({ where: { id: listingId } });
  if (!listing || listing.status !== 'ACTIVE' || listing.endsAt > now) return false;

  const settlementKey = `settle-${listingId}`;
  const result = await tx.marketListing.updateMany({
    where: { id: listingId, status: 'ACTIVE' },
    data: {
      status: listing.highestBidderId ? 'SETTLED' : 'EXPIRED',
      settledAt: now,
      settlementKey,
    },
  });
  if (result.count === 0) return false;

  const itemKey = listing.itemKey as MarketTradableItemKey;
  if (listing.highestBidderId && listing.currentBid != null) {
    await adjustPlayerItem(tx, listing.highestBidderId, itemKey, listing.quantity);
    await tx.player.update({
      where: { id: listing.sellerId },
      data: { cash: { increment: listing.currentBid } },
    });
  } else {
    await adjustPlayerItem(tx, listing.sellerId, itemKey, listing.quantity);
  }
  return true;
}

export const MarketService = {
  async settleExpired(now = new Date()) {
    return settleExpiredMarketListings(now);
  },

  async getBrowseListings(filter: MarketFilterCategory | 'all' = 'all') {
    await settleExpiredMarketListings();
    const listings = await prisma.marketListing.findMany({
      where: { status: 'ACTIVE', endsAt: { gt: new Date() } },
      include: { seller: { select: { alias: true } } },
      orderBy: { endsAt: 'asc' },
      take: 100,
    });

    return listings
      .filter((l) => listingMatchesMarketFilter(l.itemKey, filter))
      .map((l) => ({
        id: l.id,
        itemKey: l.itemKey,
        itemName: marketItemDisplayName(l.itemKey),
        quantity: l.quantity,
        startingPrice: l.startingPrice,
        currentBid: l.currentBid,
        minNextBid: minimumNextBid(l.currentBid, l.startingPrice),
        endsAt: l.endsAt.toISOString(),
        sellerAlias: l.seller.alias,
      }));
  },

  async getMyAuctions(playerId: string) {
    await settleExpiredMarketListings();
    const [selling, bidding, won] = await Promise.all([
      prisma.marketListing.findMany({
        where: { sellerId: playerId, status: { in: ['ACTIVE', 'SETTLED', 'EXPIRED'] } },
        orderBy: { createdAt: 'desc' },
        take: 20,
      }),
      prisma.marketListing.findMany({
        where: {
          highestBidderId: playerId,
          status: 'ACTIVE',
          endsAt: { gt: new Date() },
        },
        orderBy: { endsAt: 'asc' },
        take: 20,
      }),
      prisma.marketListing.findMany({
        where: { highestBidderId: playerId, status: 'SETTLED' },
        orderBy: { settledAt: 'desc' },
        take: 20,
      }),
    ]);
    return { selling, bidding, won };
  },

  async createListing(
    playerId: string,
    itemKey: string,
    quantity: number,
    startingPrice: number,
    durationMinutes: MarketDurationMinutes,
    idempotencyKey: string,
  ) {
    if (!isMarketTradableItem(itemKey)) throw new GameplayError('MARKET_ITEM_NOT_TRADABLE');
    if (!MARKET_RULES.allowedDurationMinutes.includes(durationMinutes)) {
      throw new GameplayError('INVALID_QUANTITY', 'Choose a valid auction duration.');
    }
    if (quantity <= 0 || quantity > MARKET_RULES.maxQuantityPerListing) {
      throw new GameplayError('INVALID_QUANTITY');
    }
    if (startingPrice < MARKET_RULES.minStartingPrice) {
      throw new GameplayError('INVALID_QUANTITY', `Minimum starting price is $${MARKET_RULES.minStartingPrice}.`);
    }

    const existing = await prisma.gameAction.findUnique({
      where: { playerId_idempotencyKey: { playerId, idempotencyKey } },
    });
    if (existing?.resultPayload) {
      return existing.resultPayload as { listingId: string };
    }

    const endsAt = new Date(Date.now() + durationMinutes * 60 * 1000);

    const listing = await runSerializableTransaction(async (tx) => {
      const player = await tx.player.findUniqueOrThrow({ where: { id: playerId } });
      assertPlayerCanPerformAction(player);

      const owned = readPlayerItemQuantity(player, itemKey);
      if (owned < quantity) {
        throw new GameplayError(
          'MARKET_INSUFFICIENT_QUANTITY',
          `You only have ${owned.toLocaleString()} ${marketItemDisplayName(itemKey)} available.`,
        );
      }

      await adjustPlayerItem(tx, playerId, itemKey, -quantity);

      const created = await tx.marketListing.create({
        data: {
          sellerId: playerId,
          itemKey,
          quantity,
          startingPrice,
          endsAt,
        },
      });

      await tx.gameAction.create({
        data: {
          playerId,
          seasonId: player.seasonId,
          actionType: 'MARKET_LISTING',
          idempotencyKey,
          requestPayload: { itemKey, quantity, startingPrice, durationMinutes } as object,
          resultPayload: { listingId: created.id } as object,
        },
      });

      return created;
    });

    return { listingId: listing.id };
  },

  async placeBid(playerId: string, listingId: string, amount: number, idempotencyKey: string) {
    await settleExpiredMarketListings();

    const existingBid = await prisma.marketBid.findUnique({
      where: { bidderId_idempotencyKey: { bidderId: playerId, idempotencyKey } },
    });
    if (existingBid) return { bidId: existingBid.id, amount: existingBid.amount };

    const now = new Date();
    return runSerializableTransaction(async (tx) => {
        const listing = await tx.marketListing.findUnique({ where: { id: listingId } });
        if (!listing || listing.status !== 'ACTIVE') throw new GameplayError('MARKET_LISTING_ENDED');
        if (listing.endsAt <= now) {
          throw new GameplayError('MARKET_LISTING_ENDED');
        }
        if (listing.sellerId === playerId) throw new GameplayError('MARKET_CANNOT_BID_OWN_LISTING');

        const minBid = minimumNextBid(listing.currentBid, listing.startingPrice);
        if (amount < minBid) {
          throw new GameplayError('MARKET_BID_TOO_LOW', `Minimum bid is $${minBid.toLocaleString()}.`);
        }

        const bidder = await tx.player.findUniqueOrThrow({ where: { id: playerId } });
        assertPlayerCanPerformAction(bidder);
        if (bidder.cash < amount) throw new GameplayError('INSUFFICIENT_CASH');

        if (listing.highestBidderId && listing.currentBid) {
          await tx.player.update({
            where: { id: listing.highestBidderId },
            data: { cash: { increment: listing.currentBid } },
          });
        }

        await tx.player.update({
          where: { id: playerId },
          data: { cash: { decrement: amount } },
        });

        const bid = await tx.marketBid.create({
          data: { listingId, bidderId: playerId, amount, idempotencyKey },
        });

        const updated = await tx.marketListing.updateMany({
          where: {
            id: listingId,
            status: 'ACTIVE',
            endsAt: { gt: now },
            OR: [
              { currentBid: null },
              { currentBid: { lt: amount } },
            ],
          },
          data: { currentBid: amount, highestBidderId: playerId },
        });

        if (updated.count === 0) {
          throw new GameplayError('MARKET_BID_TOO_LOW', 'Another bid was accepted first. Try again.');
        }

        return { bidId: bid.id, amount };
    });
  },
};
