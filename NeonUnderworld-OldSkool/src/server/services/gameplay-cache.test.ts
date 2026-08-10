import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockRevalidateTag = vi.fn();

vi.mock('next/cache', () => ({
  revalidateTag: (...args: unknown[]) => mockRevalidateTag(...args),
}));

vi.mock('@core/lib/db/prisma', () => ({
  prisma: {
    player: {
      findMany: vi.fn().mockResolvedValue([
        { id: 'p1', seasonId: 'season-1' },
        { id: 'p2', seasonId: 'season-1' },
      ]),
    },
  },
}));

describe('gameplay-cache', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('revalidates player and season tags', async () => {
    const { revalidatePlayerGameplayCache } = await import(
      '@local/server/services/gameplay-cache'
    );
    revalidatePlayerGameplayCache('p1', 'season-1');
    expect(mockRevalidateTag).toHaveBeenCalledWith('player-rank-p1');
    expect(mockRevalidateTag).toHaveBeenCalledWith('season-rankings-season-1');
  });

  it('revalidates multiple players from settlement', async () => {
    const { revalidatePlayersGameplayCache } = await import(
      '@local/server/services/gameplay-cache'
    );
    await revalidatePlayersGameplayCache(['p1', 'p2']);
    expect(mockRevalidateTag).toHaveBeenCalledWith('player-rank-p1');
    expect(mockRevalidateTag).toHaveBeenCalledWith('player-rank-p2');
    expect(mockRevalidateTag).toHaveBeenCalledWith('season-rankings-season-1');
  });
});
