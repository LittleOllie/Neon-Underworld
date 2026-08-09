import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ACTIVITY_TYPES, normalizeActivityCategory } from '@local/config/activity-types';
import { EMPIRE_ACTIVITY_CATEGORY_SET } from '@local/config/empire-rules';

const mockFindMany = vi.fn();

vi.mock('@core/lib/db/prisma', () => ({
  prisma: {
    activity: {
      findMany: (...args: unknown[]) => mockFindMany(...args),
      create: vi.fn(),
      count: vi.fn(),
      createMany: vi.fn(),
    },
    scoutResult: { findMany: vi.fn() },
  },
}));

describe('ActivityService — empire feed', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it('includes Shop and Production in empire feed categories', () => {
    expect(EMPIRE_ACTIVITY_CATEGORY_SET.has(ACTIVITY_TYPES.SHOP_PURCHASE)).toBe(true);
    expect(EMPIRE_ACTIVITY_CATEGORY_SET.has(ACTIVITY_TYPES.PRODUCTION)).toBe(true);
    expect(EMPIRE_ACTIVITY_CATEGORY_SET.has(ACTIVITY_TYPES.SCOUT)).toBe(true);
  });

  it('returns shop purchase after filtering', async () => {
    mockFindMany.mockResolvedValue([
      {
        id: 'a1',
        category: 'SHOP_PURCHASE',
        message: 'Purchased 5× condom',
        createdAt: new Date('2026-01-03'),
      },
      {
        id: 'a2',
        category: 'LOGIN',
        message: 'Logged in',
        createdAt: new Date('2026-01-04'),
      },
    ]);

    const { ActivityService } = await import('@local/server/services/activity.service');
    const items = await ActivityService.getEmpireRecent('p1', 12);

    expect(items).toHaveLength(1);
    expect(items[0]?.category).toBe(ACTIVITY_TYPES.SHOP_PURCHASE);
  });

  it('returns production activity', async () => {
    mockFindMany.mockResolvedValue([
      {
        id: 'p1',
        category: 'PRODUCTION',
        message: 'Produced coke',
        createdAt: new Date('2026-01-02'),
      },
    ]);

    const { ActivityService } = await import('@local/server/services/activity.service');
    const items = await ActivityService.getEmpireRecent('p1');

    expect(items[0]?.category).toBe(ACTIVITY_TYPES.PRODUCTION);
  });

  it('normalises legacy PURCHASE rows to shop purchase', async () => {
    mockFindMany.mockResolvedValue([
      {
        id: 'legacy',
        category: 'PURCHASE',
        message: 'Old purchase row',
        createdAt: new Date('2025-12-01'),
      },
    ]);

    const { ActivityService } = await import('@local/server/services/activity.service');
    const items = await ActivityService.getEmpireRecent('p1');

    expect(normalizeActivityCategory('PURCHASE')).toBe(ACTIVITY_TYPES.SHOP_PURCHASE);
    expect(items[0]?.category).toBe(ACTIVITY_TYPES.SHOP_PURCHASE);
  });

  it('orders newest first without duplicate ids', async () => {
    mockFindMany.mockResolvedValue([
      {
        id: 'dup',
        category: 'SCOUT',
        message: 'Scout 2',
        createdAt: new Date('2026-01-05'),
      },
      {
        id: 'dup',
        category: 'SCOUT',
        message: 'Scout duplicate id',
        createdAt: new Date('2026-01-04'),
      },
      {
        id: 'older',
        category: 'PRODUCTION',
        message: 'Produce',
        createdAt: new Date('2026-01-01'),
      },
    ]);

    const { ActivityService } = await import('@local/server/services/activity.service');
    const items = await ActivityService.getEmpireRecent('p1', 12);

    expect(items).toHaveLength(2);
    expect(items[0]?.id).toBe('dup');
    expect(items[1]?.id).toBe('older');
  });

  it('excludes LOGIN from empire feed', async () => {
    mockFindMany.mockResolvedValue([
      {
        id: 'login',
        category: 'LOGIN',
        message: 'Login',
        createdAt: new Date(),
      },
    ]);

    const { ActivityService } = await import('@local/server/services/activity.service');
    const items = await ActivityService.getEmpireRecent('p1');
    expect(items).toHaveLength(0);
  });
});
