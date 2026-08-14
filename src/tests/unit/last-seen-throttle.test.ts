import { describe, expect, it } from 'vitest';
import { LAST_SEEN_WRITE_THROTTLE_MS } from '../../config/game/offline-protection';

describe('lastSeen write throttle', () => {
  it('uses 60 second default throttle window', () => {
    expect(LAST_SEEN_WRITE_THROTTLE_MS).toBe(60_000);
  });

  it('skips write when recently touched unless offline or reset due', () => {
    const now = 1_000_000;
    const lastSeenAt = new Date(now - 30_000);
    const wasOffline = false;
    const resetCycle = false;
    const recentlyTouched = now - lastSeenAt.getTime() < LAST_SEEN_WRITE_THROTTLE_MS;
    const shouldWrite = !(recentlyTouched && !wasOffline && !resetCycle);
    expect(shouldWrite).toBe(false);
  });

  it('still writes when protection reset is due', () => {
    const wasOffline = false;
    const resetCycle = true;
    const recentlyTouched = true;
    const shouldWrite = !(recentlyTouched && !wasOffline && !resetCycle);
    expect(shouldWrite).toBe(true);
  });

  it('still writes when player was offline', () => {
    const wasOffline = true;
    const resetCycle = false;
    const recentlyTouched = true;
    const shouldWrite = !(recentlyTouched && !wasOffline && !resetCycle);
    expect(shouldWrite).toBe(true);
  });
});
