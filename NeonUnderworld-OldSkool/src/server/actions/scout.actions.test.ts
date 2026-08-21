import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ACTIVITY_TYPES } from '@local/config/activity-types';

const mockRecord = vi.fn();
const mockSync = vi.fn();
const mockCoreScout = vi.fn();
const mockAuth = vi.fn();
const mockFindUniqueOrThrow = vi.fn();

vi.mock('@local/server/services/activity.service', () => ({
  ActivityService: { record: (...args: unknown[]) => mockRecord(...args) },
}));

vi.mock('@local/server/services/empire.service', () => ({
  EmpireService: { syncInventory: (...args: unknown[]) => mockSync(...args) },
}));

vi.mock('@local/server/services/net-worth.service', () => ({
  NetWorthService: { calculateFromPlayer: () => 25000 },
}));

vi.mock('@core/lib/db/prisma', () => ({
  prisma: {
    player: { findUniqueOrThrow: (...args: unknown[]) => mockFindUniqueOrThrow(...args) },
  },
}));

vi.mock('@core/server/actions/scout.actions', () => ({
  scoutAction: (...args: unknown[]) => mockCoreScout(...args),
}));

vi.mock('@local/server/services/gameplay-cache', () => ({
  revalidatePlayerGameplayCache: vi.fn(),
}));

vi.mock('@local/server/services/shell-snapshot.service', () => ({
  finalizeLocalMutationShell: vi.fn(async () => ({
    cash: 15000,
    turns: 400,
    turnCap: 5000,
    netWorth: 25000,
    rank: 5,
    district: 'Neon Strip',
    unreadReports: 0,
  })),
}));

vi.mock('@local/lib/auth/config', () => ({
  auth: () => mockAuth(),
}));

vi.mock('@local/server/services/gameplay-analytics-hook', () => ({
  recordPostGameplayAnalytics: vi.fn(async () => {}),
  GAMEPLAY_ANALYTICS_EVENTS: { SCOUT_COMPLETED: 'SCOUT_COMPLETED' },
}));

describe('scoutAction — district scout', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuth.mockResolvedValue({ user: { playerId: 'player-1' } });
    mockFindUniqueOrThrow.mockResolvedValue({
      id: 'player-1',
      seasonId: 'season-1',
      district: { name: 'Neon Strip', slug: 'neon-strip' },
      turnState: {
        currentTurns: 400,
        lastRegeneratedAt: new Date(),
        turnCap: 5000,
        regenerationRate: 0.00000667,
      },
      cash: 1000,
      bankCash: 0,
      prostitutes: 10,
      thugs: 3,
      rides: 0,
      glocks: 0,
      uzis: 0,
      aks: 0,
      hash: 0,
      shrooms: 0,
      coke: 0,
      heroin: 0,
      businesses: 0,
      districtId: 'district-1',
      season: { startsAt: new Date(), endsAt: new Date(Date.now() + 7 * 86400000) },
    });
    mockCoreScout.mockResolvedValue({
      success: true,
      data: {
        prostitutesFound: 4,
        thugsFound: 1,
        cashEarned: 9000,
        turnsSpent: 100,
        prostitutesLost: 0,
        thugsLost: 0,
        netWorthChange: 1000,
        newNetWorth: 20000,
        newTurns: 400,
        summary: 'Good run',
        newCash: 15000,
        newProstitutes: 10,
        newThugs: 3,
      },
    });
  });

  it('records SCOUT activity without creating inbox report', async () => {
    const { scoutAction } = await import('@local/server/actions/scout.actions');
    const result = await scoutAction(100, 'test-key');

    expect(result.success).toBe(true);
    expect(mockRecord).toHaveBeenCalledOnce();
    const [, category] = mockRecord.mock.calls[0] as [string, string];
    expect(category).toBe(ACTIVITY_TYPES.SCOUT);
    if (result.success) {
      expect(result.data.canonicalNetWorth).toBe(25000);
      expect(result.data.shell.rank).toBe(5);
    }
  });
});
