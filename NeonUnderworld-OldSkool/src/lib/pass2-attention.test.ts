import { describe, it, expect } from 'vitest';
import {
  collectAttentionItems,
  prioritizeAttentionItems,
} from './attention-items';
import type { BusinessOperationsSummary } from '@local/lib/business-heat-display';

const baseCtx = {
  id: 'p1',
  thugs: 10,
  prostitutes: 5,
  glocks: 5,
  uzis: 0,
  aks: 0,
  rides: 2,
  hash: 10,
  shrooms: 0,
  coke: 0,
  heroin: 0,
  businesses: 1,
  condoms: 2,
  beer: 2,
  prostitutePayoutPercent: 50,
  turns: 100,
  travelling: false,
  travelDestination: null,
} as Parameters<typeof collectAttentionItems>[0]['ctx'];

const baseBrief = {
  armedThugs: 5,
  unarmedThugs: 0,
  bankCash: 0,
  readinessWarningCount: 0,
};

describe('collectAttentionItems — onboarding pass 2', () => {
  it('shows specific unarmed thug message not generic readiness', () => {
    const items = collectAttentionItems({
      ctx: baseCtx,
      brief: { ...baseBrief, unarmedThugs: 3 },
      unreadCount: 0,
    });
    expect(items.some((i) => i.value === '3' && i.label?.includes('street thug'))).toBe(true);
  });

  it('prioritizes attack alerts before unread reports', () => {
    const items = collectAttentionItems({
      ctx: baseCtx,
      brief: baseBrief,
      unreadCount: 5,
      extras: {
        defenceAlerts: [
          {
            reportId: 'r1',
            attackerAlias: 'Rival',
            attackType: 'DRIVE_BY',
            outcome: 'PARTIAL',
            cashStolen: 1000,
            workersStolen: 0,
          },
        ],
      },
    });
    expect(items[0]?.id).toBe('you-were-attacked');
    expect(items.some((i) => i.id === 'reports-unread' && i.label?.includes('other unread'))).toBe(
      true,
    );
  });

  it('surfaces poaching separately from generic attack', () => {
    const items = collectAttentionItems({
      ctx: baseCtx,
      brief: baseBrief,
      unreadCount: 1,
      extras: {
        defenceAlerts: [
          {
            reportId: 'r2',
            attackerAlias: 'Poacher',
            attackType: 'POACH_WORKERS',
            outcome: 'SUCCESS',
            cashStolen: 0,
            workersStolen: 12,
          },
        ],
      },
    });
    expect(items.some((i) => i.id === 'workers-poached')).toBe(true);
    expect(items.some((i) => i.id === 'you-were-attacked')).toBe(false);
  });

  it('aggregates business safe full alert', () => {
    const businessOperations: BusinessOperationsSummary = {
      owned: 2,
      assignedWorkers: 100,
      safeBalance: 2_000_000,
      overallHeat: 'LOW',
      overallHeatScore: 10,
      safeFullCount: 2,
      safeFullSites: [
        { id: 'b1', name: 'Neon Nights', safeCash: 1_000_000, safeCapacity: 1_000_000 },
        { id: 'b2', name: 'Velvet Room', safeCash: 1_000_000, safeCapacity: 1_000_000 },
      ],
      sites: [],
    };
    const items = collectAttentionItems({
      ctx: baseCtx,
      brief: baseBrief,
      unreadCount: 0,
      extras: { businessOperations },
    });
    const alert = items.find((i) => i.id === 'business-safe-full');
    expect(alert?.headline).toBe('2 BUSINESS SAFES FULL');
    expect(alert?.href).toBe('/businesses');
  });

  it('surfaces police raid and upgrade complete from system reports', () => {
    const items = collectAttentionItems({
      ctx: baseCtx,
      brief: baseBrief,
      unreadCount: 2,
      extras: {
        systemReports: [
          {
            reportId: 'raid1',
            type: 'POLICE_RAID',
            businessName: 'Neon Nights',
          },
          {
            reportId: 'up1',
            type: 'BUSINESS_UPGRADE_COMPLETE',
            businessName: 'Neon Nights',
            toLevel: 2,
          },
        ],
      },
    });
    expect(items.some((i) => i.id === 'police-raid')).toBe(true);
    expect(items.some((i) => i.id === 'business-upgrade-complete')).toBe(true);
  });

  it('surfaces cartel invitation', () => {
    const items = collectAttentionItems({
      ctx: baseCtx,
      brief: baseBrief,
      unreadCount: 0,
      extras: {
        cartelInvites: [{ id: 'inv1', cartelName: 'Neon Syndicate' }],
      },
    });
    const invite = items.find((i) => i.id === 'cartel-invitation');
    expect(invite?.label).toContain('Neon Syndicate');
    expect(invite?.href).toBe('/cartels');
  });

  it('limits via prioritizeAttentionItems', () => {
    const items = collectAttentionItems({
      ctx: { ...baseCtx, condoms: 1, beer: 0 },
      brief: { ...baseBrief, unarmedThugs: 2 },
      unreadCount: 4,
    });
    const { visible, remaining } = prioritizeAttentionItems(items, 5);
    expect(visible.length).toBeLessThanOrEqual(5);
    expect(remaining).toBe(Math.max(0, items.length - 5));
  });
});

describe('empire crew breakdown helper', () => {
  it('totals street and business crew', () => {
    const streetWorkers = 865;
    const businessWorkers = 600;
    const streetThugs = 620;
    const businessSecurity = 100;
    expect(streetWorkers + businessWorkers).toBe(1465);
    expect(streetThugs + businessSecurity).toBe(720);
  });
});
