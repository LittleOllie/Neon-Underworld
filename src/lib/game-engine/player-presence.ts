/** Shared player presence helpers — mirrors OldSkool PlayerStatusService. */
export const ONLINE_THRESHOLD_MS = 15 * 60 * 1000;

export function resolveLastSeen(
  lastLoginAt: Date | null | undefined,
  statusLastSeenAt: Date | null | undefined,
  updatedAt?: Date | null,
): Date | null {
  if (statusLastSeenAt) return statusLastSeenAt;
  if (lastLoginAt) return lastLoginAt;
  return updatedAt ?? null;
}

export function isPlayerOnline(lastSeen: Date | null, now = Date.now()): boolean {
  if (!lastSeen) return false;
  return now - lastSeen.getTime() < ONLINE_THRESHOLD_MS;
}
