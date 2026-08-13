import { auth } from '@local/lib/auth/config';
import { assertUserNotBanned } from '@core/lib/auth/ban-guard';

export interface ActivePlayerSession {
  playerId: string;
  userId: string;
}

/**
 * Shared gameplay session guard — authenticated player with live ban check.
 * Returns null when unauthenticated (caller handles as before).
 * Throws GameplayError ACCOUNT_RESTRICTED when banned.
 */
export async function requireActivePlayerSession(): Promise<ActivePlayerSession | null> {
  const session = await auth();
  const playerId = session?.user?.playerId;
  const userId = session?.user?.id;
  if (!playerId || !userId) return null;
  await assertUserNotBanned(userId);
  return { playerId, userId };
}
