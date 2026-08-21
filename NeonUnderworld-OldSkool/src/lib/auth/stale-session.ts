import { redirect } from 'next/navigation';
import { prisma } from '@core/lib/db/prisma';

export const STALE_SESSION_PATH = '/api/auth/clear-stale-session';

/** Redirect to route handler when cookie playerId is missing from this database. */
export async function redirectIfPlayerMissing(playerId: string | null | undefined): Promise<void> {
  if (!playerId) return;

  const playerExists = await prisma.player.findUnique({
    where: { id: playerId },
    select: { id: true },
  });

  if (!playerExists) {
    redirect(STALE_SESSION_PATH);
  }
}
