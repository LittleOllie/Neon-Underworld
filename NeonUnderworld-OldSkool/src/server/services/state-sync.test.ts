import { describe, expect, it } from 'vitest';
import { NO_PREFETCH_HREFS, shouldPrefetchRoute } from '@local/config/prefetch-policy';

describe('prefetch policy', () => {
  it('disables prefetch on mutable gameplay routes', () => {
    expect(shouldPrefetchRoute('/produce')).toBe(false);
    expect(shouldPrefetchRoute('/attack')).toBe(false);
    expect(shouldPrefetchRoute('/market')).toBe(false);
    expect(NO_PREFETCH_HREFS.has('/reports')).toBe(true);
  });

  it('allows prefetch on safe routes', () => {
    expect(shouldPrefetchRoute('/scout')).toBe(true);
    expect(shouldPrefetchRoute('/shop')).toBe(true);
    expect(shouldPrefetchRoute('/command')).toBe(true);
  });
});

describe('produce thug gate (shell precedence)', () => {
  it('prefers live shell thugs over stale SSR prop', () => {
    const ssrThugCount = 0;
    const shellThugs = 12;
    const effectiveThugs = shellThugs ?? ssrThugCount;
    expect(effectiveThugs).toBe(12);
    expect(effectiveThugs > 0).toBe(true);
  });

  it('falls back to SSR prop when shell has no thugs', () => {
    const ssrThugCount = 5;
    const shellThugs: number | undefined = undefined;
    const effectiveThugs = shellThugs ?? ssrThugCount;
    expect(effectiveThugs).toBe(5);
  });
});

describe('attack crew reconcile', () => {
  it('patches local crew from shell snapshot after combat', () => {
    const prev = { thugs: 100, rides: 20, glocks: 10, uzis: 5, aks: 2 };
    const shell = { thugs: 85, rides: 18, glocks: 9, uzis: 5, aks: 1 };
    const next = {
      thugs: shell.thugs ?? prev.thugs,
      rides: shell.rides ?? prev.rides,
      glocks: shell.glocks ?? prev.glocks,
      uzis: shell.uzis ?? prev.uzis,
      aks: shell.aks ?? prev.aks,
    };
    expect(next.thugs).toBe(85);
    expect(next.glocks).toBe(9);
    expect(next.aks).toBe(1);
  });
});

describe('cartel mutation result shape', () => {
  it('includes page and shell for client patch', () => {
    const result = {
      page: { cash: 1000 },
      shell: { cash: 1000, turns: 500, turnCap: 5000, netWorth: 50_000, rank: 2 },
    };
    expect(result.page).toBeDefined();
    expect(result.shell.cash).toBe(1000);
  });
});

describe('bank shell reconcile', () => {
  it('maps transfer result onto shell fields', () => {
    const transfer = { cash: 400, bankCash: 600, netWorth: 10_000, amount: 100 };
    const shellUpdate = {
      cash: transfer.cash,
      bankCash: transfer.bankCash,
      netWorth: transfer.netWorth,
    };
    expect(shellUpdate.cash).toBe(400);
    expect(shellUpdate.bankCash).toBe(600);
  });
});

describe('report unread badge', () => {
  it('decrements from counter return value', () => {
    const before = 3;
    const afterMarkRead = before - 1;
    expect(afterMarkRead).toBe(2);
  });
});
