import { describe, expect, it } from 'vitest';
import { routeLoadingMessage, ACTION_PENDING } from '@local/lib/loading-copy';

describe('loading-copy', () => {
  it('returns route-specific loading messages', () => {
    expect(routeLoadingMessage('/market')).toBe('Connecting to market…');
    expect(routeLoadingMessage('/rankings')).toBe('Checking the network…');
    expect(routeLoadingMessage('/reports/abc')).toBe('Decrypting report…');
  });

  it('exposes gameplay pending copy', () => {
    expect(ACTION_PENDING.scout).toBe('Scouting…');
    expect(ACTION_PENDING.produce).toBe('Producing…');
    expect(ACTION_PENDING.shopPurchase).toBe('Buying…');
    expect(ACTION_PENDING.businessCollect).toBe('Collecting cash…');
    expect(ACTION_PENDING.travel('Docklands')).toBe('Travelling to Docklands…');
  });
});
