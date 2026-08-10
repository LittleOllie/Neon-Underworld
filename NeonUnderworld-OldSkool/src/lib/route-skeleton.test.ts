import { describe, expect, it } from 'vitest';
import { getRouteSkeletonVariant } from '@local/lib/route-skeleton';

describe('route skeleton variants', () => {
  it('maps major routes to appropriate skeleton layouts', () => {
    expect(getRouteSkeletonVariant('/command')).toBe('home');
    expect(getRouteSkeletonVariant('/empire')).toBe('empire');
    expect(getRouteSkeletonVariant('/produce')).toBe('action');
    expect(getRouteSkeletonVariant('/shop')).toBe('shop');
    expect(getRouteSkeletonVariant('/rankings')).toBe('list');
    expect(getRouteSkeletonVariant('/players/foo')).toBe('profile');
  });
});
