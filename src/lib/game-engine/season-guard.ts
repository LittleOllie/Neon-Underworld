import { SeasonInactiveError } from '@/lib/game-engine/errors';
import { prisma } from '@/lib/db/prisma';

/**
 * Closed-test round enforcement. Off by default so open trial play is not blocked
 * by local admin/test round state. Set NU_ENFORCE_ACTIVE_SEASON=true when the
 * 7-day test begins (after admin starts the official round).
 */
export function isSeasonEnforcementEnabled(): boolean {
  return process.env.NU_ENFORCE_ACTIVE_SEASON === 'true';
}

/** Block turn-spending actions when the player's season is not ACTIVE (enforcement only). */
export function assertGameplaySeasonActive(season: { status: string }): void {
  if (!isSeasonEnforcementEnabled()) return;
  if (season.status !== 'ACTIVE') {
    throw new SeasonInactiveError();
  }
}

/** Season for new registrations — trial mode falls back to the latest round. */
export async function resolveRegistrationSeason() {
  const active = await prisma.season.findFirst({ where: { status: 'ACTIVE' } });
  if (active) return active;
  if (!isSeasonEnforcementEnabled()) {
    return prisma.season.findFirst({ orderBy: { number: 'desc' } });
  }
  return null;
}
