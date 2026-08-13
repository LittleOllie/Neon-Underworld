import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  BUSINESS_UPGRADE_DURATION_MS,
  getBusinessUpgradeDurationMs,
  getBusinessUpgradeDurationLabel,
  getBusinessDrugProductionBonus,
} from '@/config/game/business-levels';
import {
  getBusinessInvestedValue,
  getBusinessInvestedValueForState,
  getBusinessStreetNwAssetForState,
  getBusinessPaidInvestmentLevel,
  isBusinessUpgrading,
  businessHourlyIncome,
} from '@/config/game/business-rules';
import {
  maybeCompleteBusinessUpgradeInTransaction,
  validateStartUpgrade,
  aggregateBusinessNwContext,
} from '@/server/services/business.service';

describe('V1.2 upgrade durations', () => {
  it('uses canonical durations', () => {
    expect(getBusinessUpgradeDurationMs(2)).toBe(BUSINESS_UPGRADE_DURATION_MS[2]);
    expect(getBusinessUpgradeDurationMs(3)).toBe(6 * 60 * 60 * 1000);
    expect(getBusinessUpgradeDurationMs(4)).toBe(12 * 60 * 60 * 1000);
    expect(getBusinessUpgradeDurationMs(5)).toBe(24 * 60 * 60 * 1000);
  });

  it('labels hours for UI', () => {
    expect(getBusinessUpgradeDurationLabel(2)).toBe('2 hours');
    expect(getBusinessUpgradeDurationLabel(5)).toBe('24 hours');
  });
});

describe('V1.2 paid investment vs functional level', () => {
  it('includes paid upgrade target in investment level', () => {
    expect(
      getBusinessPaidInvestmentLevel({
        businessType: 'NIGHTCLUB',
        level: 1,
        upgradeTargetLevel: 2,
      }),
    ).toBe(2);
  });

  it('nightclub L1→L2 NW during upgrade', () => {
    expect(
      getBusinessInvestedValueForState({
        businessType: 'NIGHTCLUB',
        level: 1,
        upgradeTargetLevel: 2,
      }),
    ).toBe(8_000_000);
    expect(
      getBusinessStreetNwAssetForState({
        businessType: 'NIGHTCLUB',
        level: 1,
        upgradeTargetLevel: 2,
      }),
    ).toBe(4_000_000);
  });

  it('NW unchanged after completion level matches paid target', () => {
    const during = getBusinessStreetNwAssetForState({
      businessType: 'NIGHTCLUB',
      level: 1,
      upgradeTargetLevel: 2,
    });
    const after = getBusinessStreetNwAssetForState({
      businessType: 'NIGHTCLUB',
      level: 2,
      upgradeTargetLevel: null,
    });
    expect(after).toBe(during);
  });

  it('aggregate NW uses paid investment level', () => {
    const ctx = aggregateBusinessNwContext([
      {
        businessType: 'NIGHTCLUB',
        level: 1,
        upgradeTargetLevel: 2,
        assignedWorkers: 100,
        assignedThugs: 0,
      },
    ]);
    expect(ctx.businessStreetAssets).toBe(4_000_000);
  });
});

describe('V1.2 validate start upgrade', () => {
  it('blocks when upgrade already underway', () => {
    expect(validateStartUpgrade(2, 3, 10_000_000, 'NIGHTCLUB')).toMatch(/already in progress/i);
  });

  it('blocks L5', () => {
    expect(validateStartUpgrade(5, null, 10_000_000, 'NIGHTCLUB')).toMatch(/maximum level/i);
  });

  it('blocks insufficient cash', () => {
    expect(validateStartUpgrade(1, null, 1_000, 'NIGHTCLUB')).toMatch(/insufficient/i);
  });
});

describe('V1.2 business operates during upgrade', () => {
  it('uses functional L1 caps for income while upgrading to L2', () => {
    const l1 = businessHourlyIncome('NIGHTCLUB', 600, 1);
    const l2 = businessHourlyIncome('NIGHTCLUB', 600, 2);
    expect(l1).toBeLessThan(l2);
    expect(businessHourlyIncome('NIGHTCLUB', 600, 1)).toBe(l1);
  });

  it('drug lab bonus uses functional level only', () => {
    expect(getBusinessDrugProductionBonus([{ businessType: 'DRUG_LAB', level: 3 }])).toBeCloseTo(
      0.06,
      5,
    );
  });
});

describe('V1.2 lazy upgrade completion', () => {
  const baseRow = {
    id: 'biz1',
    playerId: 'p1',
    businessType: 'NIGHTCLUB' as const,
    districtId: 'd1',
    name: 'Nightclub #1',
    purchasePrice: 5_000_000,
    level: 1,
    assignedWorkers: 100,
    assignedThugs: 0,
    safeCash: 0,
    hash: 0,
    shrooms: 0,
    coke: 0,
    heroin: 0,
    lastSettledAt: new Date(),
    lastRaidCheckAt: new Date(),
    createdAt: new Date(),
    updatedAt: new Date(),
    upgradeTargetLevel: 2,
    upgradeStartedAt: new Date('2026-08-13T10:00:00Z'),
    upgradeCompletesAt: new Date('2026-08-13T12:00:00Z'),
  };

  function mockTx(row: typeof baseRow | null, updateCount = 1) {
    return {
      business: {
        findUnique: vi.fn().mockResolvedValue(row),
        findUniqueOrThrow: vi.fn().mockImplementation(async ({ where }: { where: { id: string } }) => {
          if (!row || row.id !== where.id) throw new Error('not found');
          return {
            ...row,
            level: 2,
            upgradeTargetLevel: null,
            upgradeStartedAt: null,
            upgradeCompletesAt: null,
          };
        }),
        updateMany: vi.fn().mockResolvedValue({ count: updateCount }),
      },
      report: { create: vi.fn().mockResolvedValue({}) },
      playerStatusExt: { upsert: vi.fn().mockResolvedValue({}) },
    };
  }

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('does not complete before timestamp', async () => {
    const tx = mockTx(baseRow, 0);
    const now = new Date('2026-08-13T11:00:00Z');
    const result = await maybeCompleteBusinessUpgradeInTransaction(tx as never, 'biz1', now);
    expect(result?.level).toBe(1);
    expect(tx.business.updateMany).not.toHaveBeenCalled();
  });

  it('completes at or after timestamp exactly once', async () => {
    const tx = mockTx(baseRow, 1);
    const now = new Date('2026-08-13T12:00:00Z');
    const result = await maybeCompleteBusinessUpgradeInTransaction(tx as never, 'biz1', now);
    expect(tx.business.updateMany).toHaveBeenCalledTimes(1);
    expect(result?.level).toBe(2);
    expect(tx.report.create).toHaveBeenCalledTimes(1);
  });

  it('is idempotent when updateMany returns 0', async () => {
    const tx = mockTx(baseRow, 0);
    const now = new Date('2026-08-13T13:00:00Z');
    await maybeCompleteBusinessUpgradeInTransaction(tx as never, 'biz1', now);
    expect(tx.report.create).not.toHaveBeenCalled();
  });
});

describe('V1.2 isBusinessUpgrading', () => {
  it('true when target and completesAt set', () => {
    expect(
      isBusinessUpgrading({ upgradeTargetLevel: 2, upgradeCompletesAt: new Date() }),
    ).toBe(true);
  });

  it('false when idle', () => {
    expect(isBusinessUpgrading({ upgradeTargetLevel: null, upgradeCompletesAt: null })).toBe(false);
  });
});

describe('V1.2 NW baseline unchanged at L1', () => {
  it('nightclub L1 canonical investment', () => {
    expect(getBusinessInvestedValue('NIGHTCLUB', 1)).toBe(5_000_000);
  });
});
