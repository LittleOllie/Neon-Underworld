import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockAuth = vi.fn();
const mockUpdate = vi.fn();
const mockRevalidateGameplay = vi.fn();

vi.mock('@local/lib/auth/config', () => ({
  auth: () => mockAuth(),
}));

vi.mock('@core/lib/db/prisma', () => ({
  prisma: {
    player: {
      update: (...args: unknown[]) => mockUpdate(...args),
    },
  },
}));

vi.mock('@local/server/services/gameplay-cache', () => ({
  revalidatePlayerGameplayCache: (...args: unknown[]) => mockRevalidateGameplay(...args),
}));

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}));

describe('setWireEnabledAction', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuth.mockResolvedValue({ user: { playerId: 'player-1' } });
    mockUpdate.mockResolvedValue({ wireEnabled: true, seasonId: 'season-1' });
  });

  it('rejects unauthenticated requests', async () => {
    mockAuth.mockResolvedValue(null);
    const { setWireEnabledAction } = await import('@local/server/actions/player-wire.actions');
    const result = await setWireEnabledAction(true);
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error).toMatch(/signed in/i);
  });

  it('updates only the authenticated player wireEnabled flag', async () => {
    const { setWireEnabledAction } = await import('@local/server/actions/player-wire.actions');
    const result = await setWireEnabledAction(true);

    expect(result.success).toBe(true);
    expect(mockUpdate).toHaveBeenCalledWith({
      where: { id: 'player-1' },
      data: { wireEnabled: true },
      select: { wireEnabled: true, seasonId: true },
    });
    expect(mockRevalidateGameplay).toHaveBeenCalledWith('player-1', 'season-1');
  });

  it('rejects non-boolean values', async () => {
    const { setWireEnabledAction } = await import('@local/server/actions/player-wire.actions');
    const result = await setWireEnabledAction('yes' as unknown as boolean);
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error).toMatch(/invalid/i);
  });
});
