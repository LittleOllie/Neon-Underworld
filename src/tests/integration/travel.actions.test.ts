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

describe('travelAction idempotency', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequirePlayer.mockResolvedValue({ user: { playerId: 'player-1' } });
  });

  it('returns stored completed payload on retry', async () => {
    const completed = {
      destinationSlug: 'docklands',
      destinationName: 'Docklands',
      turnsSpent: 10,
      newTurns: 90,
      ridesRequired: 2,
      ridesRemaining: 5,
      message: 'You travelled to Docklands.',
    };
    mockFindUnique.mockResolvedValue({ resultPayload: completed });

    const { travelAction } = await import('@/server/actions/travel.actions');
    const result = await travelAction('docklands', 'idem-1');
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toEqual(completed);
    }
    expect(mockTransaction).not.toHaveBeenCalled();
  });

  it('does not treat empty payload as completed', async () => {
    mockFindUnique.mockResolvedValue({ resultPayload: {} });
    mockTransaction.mockRejectedValue(new Error('should run transaction'));

    const { travelAction } = await import('@/server/actions/travel.actions');
    const result = await travelAction('docklands', 'idem-2');
    expect(result.success).toBe(false);
    expect(mockTransaction).toHaveBeenCalled();
  });
});
