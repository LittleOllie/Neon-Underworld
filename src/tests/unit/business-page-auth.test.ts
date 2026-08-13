import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GameplayError } from '@/lib/game-engine/gameplay-errors';

vi.mock('@/lib/auth/session', () => ({
  requirePlayer: vi.fn(),
}));

vi.mock('@/lib/db/prisma', () => ({
  prisma: {
    player: {
      findUniqueOrThrow: vi.fn(),
    },
    business: {
      findMany: vi.fn(),
    },
  },
}));

import { requirePlayer } from '@/lib/auth/session';
import { getBusinessesPageData } from '@/server/actions/business.actions';

describe('getBusinessesPageData authorization', () => {
  beforeEach(() => {
    vi.mocked(requirePlayer).mockReset();
  });

  it('rejects when session playerId does not match requested playerId', async () => {
    vi.mocked(requirePlayer).mockResolvedValue({
      user: { id: 'user-a', playerId: 'player-a' },
    } as never);

    await expect(getBusinessesPageData('player-b')).rejects.toMatchObject({
      gameplayCode: 'INVALID_TARGET',
    });
    await expect(getBusinessesPageData('player-b')).rejects.toBeInstanceOf(GameplayError);
  });
});
