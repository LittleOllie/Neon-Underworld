import { describe, it, expect } from 'vitest';
import { formatRank } from '@local/lib/format-rank';
import { resolveShopPageParams, shopHrefForItem } from '@local/config/shop-display';

describe('formatRank', () => {
  it('never displays #0', () => {
    expect(formatRank(0)).toBe('—');
    expect(formatRank(-1)).toBe('—');
    expect(formatRank(null)).toBe('—');
  });

  it('formats valid ranks', () => {
    expect(formatRank(1)).toBe('#1');
    expect(formatRank(42)).toBe('#42');
  });
});

describe('shop deep links', () => {
  it('links empire beer to shop beer item', () => {
    expect(shopHrefForItem('beer')).toBe('/shop?tab=supplies&item=beer');
  });

  it('resolves item param to supplies tab', () => {
    const resolved = resolveShopPageParams(undefined, 'beer');
    expect(resolved.initialTab).toBe('supplies');
    expect(resolved.highlightItem).toBe('beer');
  });

  it('ignores invalid item params safely', () => {
    const resolved = resolveShopPageParams(undefined, 'not-an-item');
    expect(resolved.highlightItem).toBeNull();
    expect(resolved.initialTab).toBe('weapons');
  });
});
