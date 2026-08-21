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

describe('shopCartCheckoutAction — atomic checkout', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequirePlayer.mockResolvedValue({
      user: { id: 'user-1', playerId: 'player-1' },
    });
    mockFindUnique.mockResolvedValue(null);
  });

  it('rejects manipulated client totals by using server pricing', async () => {
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
              beer: 0,
              thugs: 0,
              season: { status: 'ACTIVE' },
            })
            .mockResolvedValueOnce({
              id: 'player-1',
              cash: 4500,
              beer: 100,
              thugs: 0,
              glocks: 0,
            }),
          updateMany: vi.fn().mockResolvedValue({ count: 1 }),
        },
        gameAction: { create: vi.fn() },
        economicAuditLog: { create: vi.fn() },
      }),
    );

    const { shopCartCheckoutAction } = await import('@/server/actions/shop.actions');
    const result = await shopCartCheckoutAction(
      [{ itemId: 'beer', quantity: 100 }],
      '11111111-1111-4111-8111-111111111111',
    );

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.totalCost).toBe(400);
      expect(result.data.lines[0]?.lineCost).toBe(400);
    }
  });

  it('rolls back entire order when one line is invalid', async () => {
    const { shopCartCheckoutAction } = await import('@/server/actions/shop.actions');
    const result = await shopCartCheckoutAction(
      [
        { itemId: 'beer', quantity: 10 },
        { itemId: 'whore' as 'beer', quantity: 1 },
      ],
      '22222222-2222-4222-8222-222222222222',
    );

    expect(result.success).toBe(false);
    expect(mockTransaction).not.toHaveBeenCalled();
  });

  it('rejects insufficient cash without applying partial updates', async () => {
    mockTransaction.mockImplementation(async (fn: (tx: unknown) => unknown) =>
      fn({
        player: {
          findUniqueOrThrow: vi.fn().mockResolvedValue({
            id: 'player-1',
            seasonId: 'season-1',
            cash: 100,
            lifeStatus: 'ACTIVE',
            travelling: false,
            season: { status: 'ACTIVE' },
          }),
          updateMany: vi.fn().mockResolvedValue({ count: 0 }),
        },
        gameAction: { create: vi.fn() },
        economicAuditLog: { create: vi.fn() },
      }),
    );

    const { shopCartCheckoutAction } = await import('@/server/actions/shop.actions');
    const result = await shopCartCheckoutAction(
      [
        { itemId: 'beer', quantity: 100 },
        { itemId: 'condom', quantity: 100 },
      ],
      '33333333-3333-4333-8333-333333333333',
    );

    expect(result.success).toBe(false);
  });
});
