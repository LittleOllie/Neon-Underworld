import { describe, expect, it, vi } from 'vitest';
import { routeLoadingMessage, ACTION_PENDING } from '@local/lib/loading-copy';
import { getBackgroundForPath } from '@local/config/route-backgrounds';

describe('loading-copy', () => {
  it('returns route-specific loading messages', () => {
    expect(routeLoadingMessage('/market')).toBe('Opening Market…');
    expect(routeLoadingMessage('/rankings')).toBe('Loading Rankings…');
    expect(routeLoadingMessage('/reports/abc')).toBe('Opening Report…');
  });

  it('exposes gameplay pending copy', () => {
    expect(ACTION_PENDING.scout).toBe('Working the streets…');
    expect(ACTION_PENDING.travel('Docklands')).toBe('En route to Docklands…');
  });
});

describe('route-backgrounds', () => {
  it('maps paths to background keys', () => {
    expect(getBackgroundForPath('/scout')).toBe('scout');
    expect(getBackgroundForPath('/market')).toBe('market');
    expect(getBackgroundForPath('/businesses')).toBe('businesses');
    expect(getBackgroundForPath('/settings')).toBe('settings');
    expect(getBackgroundForPath('/login')).toBeUndefined();
  });
});

describe('dev-perf', () => {
  it('does not log in production', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    const spy = vi.spyOn(console, 'info');
    const { devPerf } = await import('@local/lib/dev-perf');
    await devPerf('test', async () => 42);
    expect(spy).not.toHaveBeenCalled();
    vi.unstubAllEnvs();
    spy.mockRestore();
  });
});
