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

describe('shopPurchaseAction — server validation', () => {
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
              cash: 50_000,
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
              coke: 0,
              heroin: 0,
              prostitutes: 5,
              thugs: 3,
              season: { status: 'ACTIVE' },
            })
            .mockResolvedValueOnce({
              id: 'player-1',
              cash: 49_980,
              condoms: 10,
              prostitutes: 5,
              thugs: 3,
              glocks: 0,
              uzis: 0,
              aks: 0,
              rides: 0,
              hash: 0,
              beer: 0,
              shrooms: 0,
              coke: 0,
              heroin: 0,
            }),
          updateMany: vi.fn().mockResolvedValue({ count: 1 }),
        },
        gameAction: { create: vi.fn() },
        economicAuditLog: { create: vi.fn() },
        playerStatusExt: { upsert: vi.fn().mockResolvedValue({}) },
      }),
    );
  });

  it('rejects forged worker purchase before transaction', async () => {
    const { shopPurchaseAction } = await import('@/server/actions/shop.actions');
    const result = await shopPurchaseAction(
      'whore',
      1,
      '00000000-0000-4000-8000-000000000001',
    );
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBeTruthy();
    }
    expect(mockTransaction).not.toHaveBeenCalled();
  });

  it('rejects forged thug purchase before transaction', async () => {
    const { shopPurchaseAction } = await import('@/server/actions/shop.actions');
    const result = await shopPurchaseAction(
      'thug',
      5,
      '00000000-0000-4000-8000-000000000002',
    );
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBeTruthy();
    }
    expect(mockTransaction).not.toHaveBeenCalled();
  });

  it('accepts valid support item and uses server-calculated price', async () => {
    const { shopPurchaseAction } = await import('@/server/actions/shop.actions');
    const result = await shopPurchaseAction(
      'condom',
      10,
      '00000000-0000-4000-8000-000000000003',
    );
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.totalCost).toBe(20);
      expect(result.data.unitPrice).toBe(2);
      expect(result.data.newOwnedQuantity).toBe(10);
    }
    expect(mockTransaction).toHaveBeenCalledOnce();
  });

  it('rejects invalid quantity', async () => {
    const { shopPurchaseAction } = await import('@/server/actions/shop.actions');
    const result = await shopPurchaseAction(
      'beer',
      0,
      '00000000-0000-4000-8000-000000000004',
    );
    expect(result.success).toBe(false);
    expect(mockTransaction).not.toHaveBeenCalled();
  });

  it('returns safe message for insufficient cash', async () => {
    mockTransaction.mockImplementation(async (fn: (tx: unknown) => unknown) =>
      fn({
        player: {
          findUniqueOrThrow: vi.fn().mockResolvedValue({
            id: 'player-1',
            seasonId: 'season-1',
            cash: 1,
            lifeStatus: 'ACTIVE',
            travelling: false,
            season: { status: 'ACTIVE' },
          }),
          updateMany: vi.fn().mockResolvedValue({ count: 0 }),
        },
        playerStatusExt: { upsert: vi.fn().mockResolvedValue({}) },
      }),
    );
    const { shopPurchaseAction } = await import('@/server/actions/shop.actions');
    const result = await shopPurchaseAction(
      'condom',
      10,
      '00000000-0000-4000-8000-000000000005',
    );
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toMatch(/enough cash/i);
    }
  });
});
