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

describe('homeShopSellAction — server validation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequirePlayer.mockResolvedValue({
      user: { id: 'user-1', playerId: 'player-1' },
    });
    mockFindUnique.mockResolvedValue(null);
    mockTransaction.mockImplementation(async (fn: (tx: unknown) => unknown) =>
      fn({
        player: {
          findUniqueOrThrow: vi.fn().mockResolvedValue({
            id: 'player-1',
            seasonId: 'season-1',
            cash: 5000,
            lifeStatus: 'ACTIVE',
            travelling: false,
            hash: 0,
            shrooms: 0,
            coke: 50,
            heroin: 0,
            prostitutes: 0,
            thugs: 0,
            rides: 0,
            glocks: 0,
            uzis: 0,
            aks: 0,
            condoms: 0,
            beer: 0,
            businesses: 0,
            bankCash: 0,
            season: { status: 'ACTIVE' },
          }),
          update: vi.fn().mockImplementation(({ data }) => ({
            cash: data.cash,
            coke: data.coke,
            hash: 0,
            shrooms: 0,
            heroin: 0,
            prostitutes: 0,
            thugs: 0,
            rides: 0,
            bankCash: 0,
          })),
        },
        gameAction: { create: vi.fn() },
        economicAuditLog: { create: vi.fn() },
      }),
    );
  });

  it('rejects invalid drug before transaction', async () => {
    const { homeShopSellAction } = await import('@/server/actions/home-shop.actions');
    const result = await homeShopSellAction(
      'beer',
      1,
      '00000000-0000-4000-8000-000000000001',
    );
    expect(result.success).toBe(false);
    expect(mockTransaction).not.toHaveBeenCalled();
  });

  it('rejects zero quantity', async () => {
    const { homeShopSellAction } = await import('@/server/actions/home-shop.actions');
    const result = await homeShopSellAction(
      'coke',
      0,
      '00000000-0000-4000-8000-000000000002',
    );
    expect(result.success).toBe(false);
    expect(mockTransaction).not.toHaveBeenCalled();
  });

  it('rejects selling more than owned', async () => {
    const { homeShopSellAction } = await import('@/server/actions/home-shop.actions');
    const result = await homeShopSellAction(
      'coke',
      100,
      '00000000-0000-4000-8000-000000000003',
    );
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toMatch(/don't own enough/i);
    }
    expect(mockTransaction).toHaveBeenCalled();
  });

  it('sells valid quantity with canonical price', async () => {
    const { homeShopSellAction } = await import('@/server/actions/home-shop.actions');
    const key = '00000000-0000-4000-8000-000000000004';
    const result = await homeShopSellAction('coke', 10, key);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.unitPrice).toBe(9);
      expect(result.data.totalPayout).toBe(90);
      expect(result.data.newCash).toBe(5090);
      expect(result.data.newOwnedQuantity).toBe(40);
      expect(result.data.canonicalNetWorth).toBeGreaterThan(0);
    }
  });

  it('replays idempotent request without double payout', async () => {
    const replay = {
      drug: 'coke' as const,
      quantity: 10,
      unitPrice: 9,
      totalPayout: 90,
      newCash: 5090,
      newOwnedQuantity: 40,
      canonicalNetWorth: 5200,
    };
    mockFindUnique.mockResolvedValue({ resultPayload: replay });

    const { homeShopSellAction } = await import('@/server/actions/home-shop.actions');
    const result = await homeShopSellAction(
      'coke',
      10,
      '00000000-0000-4000-8000-000000000005',
    );
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toEqual(replay);
    }
    expect(mockTransaction).not.toHaveBeenCalled();
  });
});
