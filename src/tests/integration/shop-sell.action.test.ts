import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockRequirePlayer = vi.fn();
const mockFindUnique = vi.fn();
const mockTransaction = vi.fn();

vi.mock('@/lib/auth/session', () => ({
  requirePlayer: () => mockRequirePlayer(),
}));

vi.mock('@/lib/db/prisma', () => ({
  prisma: {
    gameAction: {
      findUnique: (...args: unknown[]) => mockFindUnique(...args),
    },
    $transaction: (...args: unknown[]) => mockTransaction(...args),
  },
}));

describe('shopSellAction — server validation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequirePlayer.mockResolvedValue({
      user: { id: 'user-1', playerId: 'player-1' },
    });
    mockFindUnique.mockResolvedValue(null);
    mockTransaction.mockImplementation(async (fn: (tx: unknown) => unknown) =>
      fn({
        player: {
          findUniqueOrThrow: vi
            .fn()
            .mockResolvedValueOnce({
              id: 'player-1',
              seasonId: 'season-1',
              cash: 5000,
              lifeStatus: 'ACTIVE',
              travelling: false,
              glocks: 0,
              uzis: 0,
              aks: 0,
              rides: 0,
              condoms: 0,
              hash: 0,
              beer: 0,
              shrooms: 0,
              coke: 50,
              heroin: 0,
              prostitutes: 0,
              thugs: 0,
              businesses: 0,
              bankCash: 0,
              season: { status: 'ACTIVE' },
            })
            .mockResolvedValueOnce({
              cash: 5380,
              coke: 40,
              hash: 0,
              shrooms: 0,
              heroin: 0,
              prostitutes: 0,
              thugs: 0,
              rides: 0,
              glocks: 0,
              uzis: 0,
              aks: 0,
              condoms: 0,
              beer: 0,
              bankCash: 0,
            }),
          updateMany: vi.fn().mockResolvedValue({ count: 1 }),
        },
        gameAction: { create: vi.fn() },
        economicAuditLog: { create: vi.fn() },
        playerStatusExt: { upsert: vi.fn().mockResolvedValue({}) },
      }),
    );
  });

  it('rejects invalid item before transaction', async () => {
    const { shopSellAction } = await import('@/server/actions/shop.actions');
    const result = await shopSellAction('whore', 1, '00000000-0000-4000-8000-000000000001');
    expect(result.success).toBe(false);
    expect(mockTransaction).not.toHaveBeenCalled();
  });

  it('rejects selling more than owned', async () => {
    mockTransaction.mockImplementationOnce(async (fn: (tx: unknown) => unknown) =>
      fn({
        player: {
          findUniqueOrThrow: vi.fn().mockResolvedValue({
            id: 'player-1',
            seasonId: 'season-1',
            cash: 5000,
            lifeStatus: 'ACTIVE',
            travelling: false,
            coke: 50,
            glocks: 0,
            uzis: 0,
            aks: 0,
            rides: 0,
            condoms: 0,
            hash: 0,
            beer: 0,
            shrooms: 0,
            heroin: 0,
            season: { status: 'ACTIVE' },
          }),
          updateMany: vi.fn().mockResolvedValue({ count: 0 }),
        },
        playerStatusExt: { upsert: vi.fn().mockResolvedValue({}) },
      }),
    );
    const { shopSellAction } = await import('@/server/actions/shop.actions');
    const result = await shopSellAction('coke', 100, '00000000-0000-4000-8000-000000000002');
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toMatch(/enough/i);
    }
  });

  it('sells at discounted shop sell-back price', async () => {
    const { shopSellAction } = await import('@/server/actions/shop.actions');
    const result = await shopSellAction('coke', 10, '00000000-0000-4000-8000-000000000003');
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.unitPrice).toBe(38);
      expect(result.data.totalPayout).toBe(380);
      expect(result.data.newOwnedQuantity).toBe(40);
    }
  });

  it('replays idempotent request without double payout', async () => {
    const replay = {
      item: 'coke' as const,
      quantity: 10,
      unitPrice: 38,
      totalPayout: 380,
      newCash: 5380,
      newOwnedQuantity: 40,
      newNetWorth: 5000,
      canonicalNetWorth: 5000,
    };
    mockFindUnique.mockResolvedValue({ resultPayload: replay });

    const { shopSellAction } = await import('@/server/actions/shop.actions');
    const result = await shopSellAction('coke', 10, '00000000-0000-4000-8000-000000000004');
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toEqual(replay);
    }
    expect(mockTransaction).not.toHaveBeenCalled();
  });
});
