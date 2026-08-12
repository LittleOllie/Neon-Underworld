import { describe, expect, it } from 'vitest';
import { playerRankCacheTag, seasonRankingsCacheTag } from '@local/server/services/gameplay-cache';
import { revalidatePlayerShellPaths } from '@local/server/services/shell-snapshot.service';

describe('shell snapshot helpers', () => {
  it('exposes stable cache tag names', () => {
    expect(playerRankCacheTag('player-1')).toBe('player-rank-player-1');
    expect(seasonRankingsCacheTag('season-1')).toBe('season-rankings-season-1');
  });

  it('no-ops shell path revalidation outside request context', () => {
    expect(() => revalidatePlayerShellPaths(['/shop'])).not.toThrow();
  });
});
