/** Online / last-seen labels for cartel member lists. */

export const CARTEL_ONLINE_THRESHOLD_MS = 15 * 60 * 1000;

export interface MemberPresence {
  online: boolean;
  label: string;
}

export function formatMemberPresence(
  lastLoginAt: Date | null | undefined,
  nowMs = Date.now(),
): MemberPresence {
  if (!lastLoginAt) {
    return { online: false, label: 'Unknown' };
  }

  const diffMs = nowMs - lastLoginAt.getTime();
  if (diffMs < CARTEL_ONLINE_THRESHOLD_MS) {
    return { online: true, label: 'Online' };
  }

  const mins = Math.floor(diffMs / 60_000);
  if (mins < 60) {
    return { online: false, label: `${mins}m ago` };
  }

  const hours = Math.floor(mins / 60);
  if (hours < 24) {
    return { online: false, label: `${hours}h ago` };
  }

  const days = Math.floor(hours / 24);
  return { online: false, label: `${days}d ago` };
}
