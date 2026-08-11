/** Player considered offline after this many ms without lastSeen (matches OldSkool ONLINE_THRESHOLD_MS). */
export const OFFLINE_THRESHOLD_MS = 15 * 60 * 1000;

/** Standard tier — successful damaging attacks while defender is offline before protection. */
export const OFFLINE_ATTACK_LIMIT_STANDARD = 5;

/** Future protected tier hook (not active in v1). */
export const OFFLINE_ATTACK_LIMIT_PROTECTED = 2;

export function isPlayerOffline(lastSeenAt: Date | null | undefined, now = Date.now()): boolean {
  if (!lastSeenAt) return true;
  return now - lastSeenAt.getTime() >= OFFLINE_THRESHOLD_MS;
}
