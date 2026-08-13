import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockUnstableCache = vi.fn((fn: () => unknown) => () => fn());

vi.mock('next/cache', () => ({
  unstable_cache: mockUnstableCache,
}));

vi.mock('react', () => ({
  cache: (fn: unknown) => fn,
}));

const findMany = vi.fn();
const calculateForPlayers = vi.fn();

vi.mock('@core/lib/db/prisma', () => ({
  prisma: {
    player: { findMany },
  },
}));

vi.mock('./net-worth.service', () => ({
  NetWorthService: {
    calculateForPlayers,
  },
}));

vi.mock('./player-status.service', () => ({
  PlayerStatusService: {
    resolveLastSeen: () => null,
    isOnline: () => false,
  },
}));

describe('RankingsService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it('derives single-player rank from overall season leaderboard cache', async () => {
    findMany.mockResolvedValue([
      {
        id: 'p1',
        createdAt: new Date('2026-01-01'),
        alias: 'Alpha',
        aliasNormalized: 'alpha',
        district: { name: 'Neon Strip', slug: 'neon-strip' },
        cartel: null,
        user: { lastLoginAt: null },
        statusExt: null,
        updatedAt: new Date(),
        cash: 1000,
        bankCash: 0,
        prostitutes: 0,
        thugs: 0,
        rides: 0,
        glocks: 0,
        uzis: 0,
        aks: 0,
        hash: 0,
        shrooms: 0,
        coke: 0,
        heroin: 0,
        businesses: 0,
      },
      {
        id: 'p2',
        createdAt: new Date('2026-01-02'),
        alias: 'Beta',
        aliasNormalized: 'beta',
        district: { name: 'Neon Strip', slug: 'neon-strip' },
        cartel: null,
        user: { lastLoginAt: null },
        statusExt: null,
        updatedAt: new Date(),
        cash: 500,
        bankCash: 0,
        prostitutes: 0,
        thugs: 0,
        rides: 0,
        glocks: 0,
        uzis: 0,
        aks: 0,
        hash: 0,
        shrooms: 0,
        coke: 0,
        heroin: 0,
        businesses: 0,
      },
    ]);
    calculateForPlayers.mockResolvedValue(
      new Map([
        ['p1', 5000],
        ['p2', 9000],
      ]),
    );

    const { RankingsService } = await import('./rankings.service');

    const rank = await RankingsService.getPlayerRank('p1', 'season-1');
    expect(rank).toBe(2);

    const rankAgain = await RankingsService.getPlayerRank('p2', 'season-1');
    expect(rankAgain).toBe(1);
  });

  it('getSeasonRankings assigns sequential ranks by net worth', async () => {
    findMany.mockResolvedValue([
      {
        id: 'p1',
        createdAt: new Date('2026-01-01'),
        alias: 'Alpha',
        aliasNormalized: 'alpha',
        district: { name: 'Neon Strip', slug: 'neon-strip' },
        cartel: null,
        user: { lastLoginAt: null },
        statusExt: null,
        updatedAt: new Date(),
        cash: 1000,
        bankCash: 0,
        prostitutes: 0,
        thugs: 0,
        rides: 0,
        glocks: 0,
        uzis: 0,
        aks: 0,
        hash: 0,
        shrooms: 0,
        coke: 0,
        heroin: 0,
        businesses: 0,
      },
    ]);
    calculateForPlayers.mockResolvedValue(new Map([['p1', 100]]));

    const { RankingsService } = await import('./rankings.service');
    const rows = await RankingsService.getSeasonRankings('season-1', 'overall');
    expect(rows[0]?.rank).toBe(1);
    expect(rows[0]?.id).toBe('p1');
  });
});
