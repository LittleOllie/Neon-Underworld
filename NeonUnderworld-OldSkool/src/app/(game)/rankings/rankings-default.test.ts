import { describe, it, expect } from 'vitest';
import {
  defaultRankingsFilterForDistrict,
  districtSlugToRankingsFilter,
} from '@local/server/services/rankings.service';

describe('rankings default filter', () => {
  it('maps player districts to their leaderboard tab', () => {
    expect(defaultRankingsFilterForDistrict('neon-strip')).toBe('neon-strip');
    expect(defaultRankingsFilterForDistrict('docklands')).toBe('docklands');
    expect(defaultRankingsFilterForDistrict('old-quarter')).toBe('old-quarter');
  });

  it('falls back to overall for unknown districts', () => {
    expect(defaultRankingsFilterForDistrict('unknown')).toBe('overall');
    expect(districtSlugToRankingsFilter('unknown')).toBeNull();
  });
});

function resolveFilter(param: string | undefined, districtSlug: string) {
  const filters = ['overall', 'neon-strip', 'docklands', 'old-quarter'] as const;
  if (param && filters.includes(param as (typeof filters)[number])) {
    return param;
  }
  return defaultRankingsFilterForDistrict(districtSlug);
}

describe('rankings page filter resolution', () => {
  it('defaults to player district when filter param is absent', () => {
    expect(resolveFilter(undefined, 'docklands')).toBe('docklands');
    expect(resolveFilter(undefined, 'old-quarter')).toBe('old-quarter');
    expect(resolveFilter(undefined, 'neon-strip')).toBe('neon-strip');
  });

  it('respects explicit manual filter selection', () => {
    expect(resolveFilter('overall', 'docklands')).toBe('overall');
    expect(resolveFilter('neon-strip', 'old-quarter')).toBe('neon-strip');
  });

  it('defaults to new district after travel on fresh visit', () => {
    expect(resolveFilter(undefined, 'old-quarter')).toBe('old-quarter');
  });
});
