import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockAuth = vi.fn();

vi.mock('@local/lib/auth/config', () => ({
  auth: () => mockAuth(),
}));

import {
  requireSessionPlayerId,
  assertSessionMatchesPlayer,
  SessionAuthError,
} from '@local/lib/auth/session-player';

describe('session-player auth binding', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('requireSessionPlayerId returns authenticated player ID', async () => {
    mockAuth.mockResolvedValue({ user: { playerId: 'player-a' } });
    await expect(requireSessionPlayerId()).resolves.toBe('player-a');
  });

  it('requireSessionPlayerId throws when unauthenticated', async () => {
    mockAuth.mockResolvedValue(null);
    await expect(requireSessionPlayerId()).rejects.toThrow(SessionAuthError);
  });

  it('assertSessionMatchesPlayer allows matching session player', async () => {
    mockAuth.mockResolvedValue({ user: { playerId: 'player-a' } });
    await expect(assertSessionMatchesPlayer('player-a')).resolves.toBeUndefined();
  });

  it('assertSessionMatchesPlayer rejects IDOR (Player B data for Player A session)', async () => {
    mockAuth.mockResolvedValue({ user: { playerId: 'player-a' } });
    await expect(assertSessionMatchesPlayer('player-b')).rejects.toThrow(SessionAuthError);
  });
});
