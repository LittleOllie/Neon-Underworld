import { auth } from '@local/lib/auth/config';

export class SessionAuthError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SessionAuthError';
  }
}

/** Returns the authenticated player's ID or throws. */
export async function requireSessionPlayerId(): Promise<string> {
  const session = await auth();
  const playerId = session?.user?.playerId;
  if (!playerId) {
    throw new SessionAuthError('Not authenticated');
  }
  return playerId;
}

/** Ensures the session player matches the requested player ID (prevents read IDOR). */
export async function assertSessionMatchesPlayer(playerId: string): Promise<void> {
  const sessionPlayerId = await requireSessionPlayerId();
  if (sessionPlayerId !== playerId) {
    throw new SessionAuthError('Forbidden');
  }
}
