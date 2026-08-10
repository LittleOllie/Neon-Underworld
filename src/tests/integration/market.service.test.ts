import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockFindMany = vi.fn();
const mockFindUnique = vi.fn();
const mockTransaction = vi.fn();
const mockUpdateMany = vi.fn();

vi.mock('@/lib/db/prisma', () => ({
  prisma: {
    marketListing: {
      findMany: (...args: unknown[]) => mockFindMany(...args),
      findUnique: (...args: unknown[]) => mockFindUnique(...args),
      updateMany: (...args: unknown[]) => mockUpdateMany(...args),
    },
    gameAction: {
      findUnique: vi.fn().mockResolvedValue(null),
    },
    marketBid: {
      findUnique: vi.fn().mockResolvedValue(null),
    },
    $transaction: (...args: unknown[]) => mockTransaction(...args),
  },
}));

describe('MarketService inventory flows', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFindMany.mockResolvedValue([]);
  });

  it('escrows listed quantity via negative increment', async () => {
    const playerUpdate = vi.fn().mockResolvedValue({});
    const listingCreate = vi.fn().mockResolvedValue({ id: 'listing-1' });
    const gameActionCreate = vi.fn();

    mockTransaction.mockImplementation(async (fn: (tx: unknown) => unknown) =>
      fn({
        player: {
          findUniqueOrThrow: vi.fn().mockResolvedValue({
            id: 'seller-1',
            seasonId: 'season-1',
            lifeStatus: 'ACTIVE',
            travelling: false,
            glocks: 10,
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
          }),
          update: playerUpdate,
        },
        marketListing: { create: listingCreate },
        gameAction: { create: gameActionCreate },
      }),
    );

    const { MarketService } = await import('@/server/services/market.service');
    await MarketService.createListing('seller-1', 'glock', 5, 1000, 60, 'key-list');

    expect(playerUpdate).toHaveBeenCalledWith({
      where: { id: 'seller-1' },
      data: { glocks: { increment: -5 } },
    });
  });

  it('returns unsold escrow with positive increment on expiry', async () => {
    const playerUpdate = vi.fn().mockResolvedValue({});
    const listing = {
      id: 'listing-1',
      status: 'ACTIVE',
      endsAt: new Date(Date.now() - 1000),
      sellerId: 'seller-1',
      highestBidderId: null,
      currentBid: null,
      itemKey: 'glock',
      quantity: 5,
    };

    mockFindMany.mockResolvedValue([listing]);
    mockUpdateMany.mockResolvedValue({ count: 1 });

    mockTransaction.mockImplementation(async (fn: (tx: unknown) => unknown) =>
      fn({
        marketListing: {
          findUnique: vi.fn().mockResolvedValue(listing),
          updateMany: mockUpdateMany,
        },
        player: {
          findUniqueOrThrow: vi.fn().mockResolvedValue({
            glocks: 5,
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
          }),
          update: playerUpdate,
        },
      }),
    );

    const { settleExpiredMarketListings } = await import('@/server/services/market.service');
    const settled = await settleExpiredMarketListings(new Date());
    expect(settled.settledCount).toBe(1);
    expect(settled.affectedPlayerIds).toContain('seller-1');
    expect(playerUpdate).toHaveBeenCalledWith({
      where: { id: 'seller-1' },
      data: { glocks: { increment: 5 } },
    });
  });

  it('adds won items to buyer inventory with increment', async () => {
    const playerUpdate = vi.fn().mockResolvedValue({});
    const listing = {
      id: 'listing-2',
      status: 'ACTIVE',
      endsAt: new Date(Date.now() - 1000),
      sellerId: 'seller-1',
      highestBidderId: 'buyer-1',
      currentBid: 5000,
      itemKey: 'glock',
      quantity: 5,
    };

    mockFindMany.mockResolvedValue([listing]);
    mockUpdateMany.mockResolvedValue({ count: 1 });

    mockTransaction.mockImplementation(async (fn: (tx: unknown) => unknown) =>
      fn({
        marketListing: {
          findUnique: vi.fn().mockResolvedValue(listing),
          updateMany: mockUpdateMany,
        },
        player: {
          findUniqueOrThrow: vi
            .fn()
            .mockResolvedValueOnce({
              glocks: 10,
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
            })
            .mockResolvedValueOnce({
              glocks: 10,
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
            }),
          update: playerUpdate,
        },
      }),
    );

    const { settleExpiredMarketListings } = await import('@/server/services/market.service');
    await settleExpiredMarketListings(new Date());

    expect(playerUpdate).toHaveBeenCalledWith({
      where: { id: 'buyer-1' },
      data: { glocks: { increment: 5 } },
    });
    expect(playerUpdate).toHaveBeenCalledWith({
      where: { id: 'seller-1' },
      data: { cash: { increment: 5000 } },
    });
  });

  it('settlement updateMany guard prevents duplicate side effects', async () => {
    mockFindMany.mockResolvedValue([
      {
        id: 'listing-3',
        status: 'ACTIVE',
        endsAt: new Date(Date.now() - 1000),
      },
    ]);
    mockUpdateMany.mockResolvedValue({ count: 0 });

    mockTransaction.mockImplementation(async (fn: (tx: unknown) => unknown) =>
      fn({
        marketListing: {
          findUnique: vi.fn().mockResolvedValue({
            id: 'listing-3',
            status: 'ACTIVE',
            endsAt: new Date(Date.now() - 1000),
            sellerId: 'seller-1',
            highestBidderId: null,
            currentBid: null,
            itemKey: 'glock',
            quantity: 5,
          }),
          updateMany: mockUpdateMany,
        },
        player: {
          findUniqueOrThrow: vi.fn(),
          update: vi.fn(),
        },
      }),
    );

    const { settleExpiredMarketListings } = await import('@/server/services/market.service');
    const settled = await settleExpiredMarketListings(new Date());
    expect(settled.settledCount).toBe(0);
  });
});
