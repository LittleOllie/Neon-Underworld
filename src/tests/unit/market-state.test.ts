import { describe, it, expect, vi, beforeEach } from 'vitest';
import { minimumNextBid } from '@/config/game/market-rules';

const mockFindMany = vi.fn();
const mockFindUnique = vi.fn();
const mockTransaction = vi.fn();
const mockUpdateMany = vi.fn();
const mockSeasonFindFirst = vi.fn();
const mockGameActionFindUnique = vi.fn();
const mockMarketBidFindUnique = vi.fn();

const listingsStore: Array<{
  id: string;
  sellerId: string;
  itemKey: string;
  quantity: number;
  startingPrice: number;
  currentBid: number | null;
  highestBidderId: string | null;
  status: string;
  endsAt: Date;
  createdAt: Date;
  seller: { alias: string };
}> = [];

const playersStore = new Map<
  string,
  {
    id: string;
    seasonId: string;
    lifeStatus: string;
    travelling: boolean;
    cash: number;
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
    prostitutes: number;
    thugs: number;
    alias?: string;
  }
>();

vi.mock('@/lib/db/prisma', () => ({
  prisma: {
    marketListing: {
      findMany: (...args: unknown[]) => mockFindMany(...args),
      findUnique: (...args: unknown[]) => mockFindUnique(...args),
      updateMany: (...args: unknown[]) => mockUpdateMany(...args),
    },
    gameAction: {
      findUnique: (...args: unknown[]) => mockGameActionFindUnique(...args),
    },
    marketBid: {
      findUnique: (...args: unknown[]) => mockMarketBidFindUnique(...args),
    },
    season: {
      findFirst: (...args: unknown[]) => mockSeasonFindFirst(...args),
    },
    $transaction: (...args: unknown[]) => mockTransaction(...args),
  },
}));

function seedSeller(id = 'seller-1', glocks = 1000) {
  playersStore.set(id, {
    id,
    seasonId: 'season-1',
    lifeStatus: 'ACTIVE',
    travelling: false,
    cash: 50_000,
    glocks,
    uzis: 0,
    aks: 0,
    rides: 0,
    condoms: 0,
    hash: 0,
    beer: 0,
    shrooms: 0,
    coke: 0,
    heroin: 0,
    prostitutes: 0,
    thugs: 0,
    alias: 'SellerAlias',
  });
}

function seedBidder(id = 'buyer-1', cash = 50_000) {
  playersStore.set(id, {
    id,
    seasonId: 'season-1',
    lifeStatus: 'ACTIVE',
    travelling: false,
    cash,
    glocks: 0,
    uzis: 0,
    aks: 0,
    rides: 0,
    condoms: 0,
    hash: 0,
    beer: 0,
    shrooms: 0,
    coke: 0,
    heroin: 0,
    prostitutes: 0,
    thugs: 0,
    alias: 'BuyerAlias',
  });
}

function wireMarketMocks() {
  mockFindMany.mockImplementation(async (args: { where?: Record<string, unknown> }) => {
    const now = new Date();
    const where = args?.where ?? {};

    if (where.sellerId && where.status === 'ACTIVE') {
      return listingsStore.filter(
        (l) =>
          l.sellerId === where.sellerId &&
          l.status === 'ACTIVE' &&
          l.endsAt > now,
      );
    }

    if (where.sellerId && Array.isArray((where.status as { in?: string[] })?.in)) {
      const allowed = (where.status as { in: string[] }).in;
      return listingsStore
        .filter((l) => l.sellerId === where.sellerId && allowed.includes(l.status))
        .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    }

    if (where.sellerId) {
      return listingsStore.filter((l) => l.sellerId === where.sellerId);
    }

    const active = listingsStore.filter((l) => l.status === 'ACTIVE' && l.endsAt > now);
    if (where.highestBidderId) {
      return active.filter((l) => l.highestBidderId === where.highestBidderId);
    }
    return active;
  });

  mockFindUnique.mockImplementation(async (args: { where: { id: string } }) => {
    const listing = listingsStore.find((l) => l.id === args.where.id);
    if (!listing) return null;
    return { ...listing, seller: { alias: listing.seller.alias } };
  });

  mockUpdateMany.mockResolvedValue({ count: 1 });
  mockGameActionFindUnique.mockResolvedValue(null);
  mockMarketBidFindUnique.mockResolvedValue(null);
  mockSeasonFindFirst.mockResolvedValue({ id: 'season-1' });

  mockTransaction.mockImplementation(async (fn: (tx: unknown) => unknown) =>
    fn({
      player: {
        findUniqueOrThrow: vi.fn(async ({ where }: { where: { id: string } }) => {
          const player = playersStore.get(where.id);
          if (!player) throw new Error('missing player');
          return player;
        }),
        update: vi.fn(async ({ where, data }: { where: { id: string }; data: Record<string, unknown> }) => {
          const player = playersStore.get(where.id);
          if (!player) throw new Error('missing player');
          if (data.glocks && typeof data.glocks === 'object' && 'increment' in data.glocks) {
            player.glocks += (data.glocks as { increment: number }).increment;
          }
          if (data.cash && typeof data.cash === 'object') {
            if ('increment' in data.cash) {
              player.cash += (data.cash as { increment: number }).increment;
            }
            if ('decrement' in data.cash) {
              player.cash -= (data.cash as { decrement: number }).decrement;
            }
          }
          return player;
        }),
      },
      marketListing: {
        create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => {
          const listing = {
            id: `listing-${listingsStore.length + 1}`,
            sellerId: data.sellerId as string,
            itemKey: data.itemKey as string,
            quantity: data.quantity as number,
            startingPrice: data.startingPrice as number,
            currentBid: null,
            highestBidderId: null,
            status: 'ACTIVE',
            endsAt: data.endsAt as Date,
            createdAt: new Date(),
            seller: { alias: 'SellerAlias' },
          };
          listingsStore.push(listing);
          return listing;
        }),
        findUnique: mockFindUnique,
        updateMany: vi.fn(async ({ where, data }: { where: Record<string, unknown>; data: Record<string, unknown> }) => {
          const listing = listingsStore.find((l) => l.id === where.id);
          if (!listing || listing.status !== 'ACTIVE') return { count: 0 };
          if (data.currentBid != null) listing.currentBid = data.currentBid as number;
          if (data.highestBidderId != null) listing.highestBidderId = data.highestBidderId as string;
          return { count: 1 };
        }),
      },
      marketBid: {
        create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => ({
          id: `bid-${data.listingId}`,
          ...data,
        })),
      },
      gameAction: {
        create: vi.fn(),
      },
    }),
  );
}

describe('Market boundary and state sync', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    listingsStore.length = 0;
    playersStore.clear();
    wireMarketMocks();
  });

  it('accepts quantity 1,000', async () => {
    seedSeller();
    const { MarketService } = await import('@/server/services/market.service');
    const result = await MarketService.createListing('seller-1', 'glock', 1000, 1000, 60, 'key-1000');
    expect(result.listingId).toBeTruthy();
    expect(playersStore.get('seller-1')?.glocks).toBe(0);
  });

  it('rejects quantity 1,001 with MARKET_LISTING_QUANTITY_CAP', async () => {
    const { MarketService } = await import('@/server/services/market.service');
    await expect(
      MarketService.createListing('seller-1', 'glock', 1001, 1000, 60, 'key-1001'),
    ).rejects.toMatchObject({ gameplayCode: 'MARKET_LISTING_QUANTITY_CAP' });
  });

  it('returns newly created listing in browse and my auctions', async () => {
    seedSeller('seller-1', 50);
    const { MarketService } = await import('@/server/services/market.service');
    const { listingId } = await MarketService.createListing('seller-1', 'glock', 5, 1000, 60, 'key-browse');

    const browse = await MarketService.getBrowseListings('all');
    const myAuctions = await MarketService.getMyAuctions('seller-1');

    expect(browse.some((l) => l.id === listingId)).toBe(true);
    expect(myAuctions.selling.some((l) => l.id === listingId)).toBe(true);
  });

  it('includes fresh active listing when seller has 50+ ended auctions', async () => {
    seedSeller('seller-1', 100);
    playersStore.get('seller-1')!.hash = 50;
    const now = Date.now();
    for (let i = 0; i < 55; i++) {
      listingsStore.push({
        id: `hist-${i}`,
        sellerId: 'seller-1',
        itemKey: 'glock',
        quantity: 1,
        startingPrice: 100,
        currentBid: null,
        highestBidderId: null,
        status: i % 2 === 0 ? 'SETTLED' : 'EXPIRED',
        endsAt: new Date(now - 86_400_000),
        createdAt: new Date(now - 86_400_000 - i * 1000),
        seller: { alias: 'SellerAlias' },
      });
    }

    const { MarketService } = await import('@/server/services/market.service');
    const { listingId } = await MarketService.createListing('seller-1', 'hash', 3, 1500, 60, 'key-hist');

    const myAuctions = await MarketService.getMyAuctions('seller-1');
    const fresh = myAuctions.selling.find((l) => l.id === listingId);

    expect(fresh).toBeDefined();
    expect(fresh?.status).toBe('ACTIVE');
    expect(myAuctions.selling[0]?.id).toBe(listingId);
  });

  it('returns updated bid, next minimum bid, and bidder cash after successful bid', async () => {
    seedSeller('seller-1', 10);
    seedBidder('buyer-1', 20_000);
    const { MarketService } = await import('@/server/services/market.service');
    const { listingId } = await MarketService.createListing('seller-1', 'glock', 5, 1000, 60, 'key-bid');

    const bidAmount = 1000;
    await MarketService.placeBid('buyer-1', listingId, bidAmount, 'bid-key-1');

    const browse = await MarketService.getBrowseListings('all');
    const card = browse.find((l) => l.id === listingId);
    expect(card?.currentBid).toBe(bidAmount);
    expect(card?.minNextBid).toBe(minimumNextBid(bidAmount, 1000));
    expect(playersStore.get('buyer-1')?.cash).toBe(20_000 - bidAmount);
  });
});
