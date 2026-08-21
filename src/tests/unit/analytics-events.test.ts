import { describe, it, expect } from 'vitest';
import { GAMEPLAY_ANALYTICS_EVENTS, SESSION_GAP_MS } from '@/config/game/analytics-events';

describe('analytics-events', () => {
  it('defines core closed-test gameplay events', () => {
    expect(GAMEPLAY_ANALYTICS_EVENTS.SCOUT_COMPLETED).toBe('SCOUT_COMPLETED');
    expect(GAMEPLAY_ANALYTICS_EVENTS.ROUND_ACTIVATED).toBe('ROUND_ACTIVATED');
    expect(GAMEPLAY_ANALYTICS_EVENTS.TURN_GRANT_RECEIVED).toBe('TURN_GRANT_RECEIVED');
  });

  it('uses 30 minute session gap', () => {
    expect(SESSION_GAP_MS).toBe(30 * 60 * 1000);
  });
});
