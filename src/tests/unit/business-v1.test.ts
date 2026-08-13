import { describe, it, expect } from 'vitest';
import {
  BUSINESS_PASSIVE_INCOME_FRACTION,
  BUSINESS_TURNS_PER_HOUR,
  BUSINESS_ACTIVE_WORKER_CASH_PER_TURN,
  businessHourlyIncome,
  businessHourlyIncomePerWorker,
  businessStreetNwContribution,
  getBusinessStreetNwAsset,
  getBusinessTypeRule,
} from '@/config/game/business-rules';
import { evaluateBusinessHeat, overallHeatBand } from '@/lib/game-engine/business/heat';
import { settleBusinessIncome } from '@/lib/game-engine/business/settlement';
import {
  raidCheckBlockIndex,
  resolveBusinessRaidCheck,
  shouldRunRaidCheck,
} from '@/lib/game-engine/business/raids';
import { calculateCanonicalNetWorthFromPlayer } from '@/lib/game-engine/canonical-net-worth';
import { aggregateBusinessNwContext } from '@/server/services/business.service';

const basePlayer = {
  cash: 2_000_000,
  bankCash: 0,
  thugs: 100,
  prostitutes: 500,
  rides: 5,
  hash: 1000,
  shrooms: 0,
  coke: 500,
  heroin: 0,
};

describe('business passive income', () => {
  it('targets ~20% of active produce worker hourly rate for nightclub', () => {
    const activeHourly = BUSINESS_ACTIVE_WORKER_CASH_PER_TURN * BUSINESS_TURNS_PER_HOUR;
    const passive = businessHourlyIncomePerWorker('NIGHTCLUB');
    expect(passive / activeHourly).toBeCloseTo(BUSINESS_PASSIVE_INCOME_FRACTION, 5);
  });

  it('scales by business type multiplier', () => {
    expect(businessHourlyIncomePerWorker('WAREHOUSE')).toBeCloseTo(
      businessHourlyIncomePerWorker('NIGHTCLUB') * 0.25,
      5,
    );
    expect(businessHourlyIncome('NIGHTCLUB', 500)).toBe(
      Math.floor(businessHourlyIncomePerWorker('NIGHTCLUB') * 500),
    );
  });

  it('example hourly rates for 100/500 workers at nightclub L1', () => {
    expect(businessHourlyIncome('NIGHTCLUB', 100)).toBe(5760);
    expect(businessHourlyIncome('NIGHTCLUB', 500)).toBe(28_800);
    expect(businessHourlyIncome('NIGHTCLUB', 1000)).toBe(
      Math.floor(businessHourlyIncomePerWorker('NIGHTCLUB', 1) * 600),
    );
  });
});

describe('business settlement', () => {
  it('accrues income lazily up to safe capacity', () => {
    const now = new Date('2026-08-13T12:00:00Z');
    const last = new Date('2026-08-13T06:00:00Z');
    const result = settleBusinessIncome({
      businessType: 'NIGHTCLUB',
      level: 1,
      assignedWorkers: 100,
      safeCash: 0,
      lastSettledAt: last,
      now,
    });
    expect(result.incomeAccrued).toBe(5760 * 6);
    expect(result.safeCash).toBe(5760 * 6);
  });

  it('stops accrual when safe is full', () => {
    const cap = getBusinessTypeRule('WAREHOUSE').safeCapacity;
    const now = new Date('2026-08-20T00:00:00Z');
    const last = new Date('2026-08-13T00:00:00Z');
    const result = settleBusinessIncome({
      businessType: 'WAREHOUSE',
      level: 1,
      assignedWorkers: 1000,
      safeCash: 0,
      lastSettledAt: last,
      now,
    });
    expect(result.safeCash).toBe(cap);
    expect(result.safeFull).toBe(true);
  });

  it('empty workforce earns nothing', () => {
    const result = settleBusinessIncome({
      businessType: 'NIGHTCLUB',
      level: 1,
      assignedWorkers: 0,
      safeCash: 0,
      lastSettledAt: new Date(),
      now: new Date(Date.now() + 3600_000),
    });
    expect(result.incomeAccrued).toBe(0);
  });
});

describe('business heat', () => {
  it('empty warehouse stays low', () => {
    const heat = evaluateBusinessHeat({
      businessType: 'WAREHOUSE',
      level: 1,
      assignedWorkers: 50,
      safeCash: 0,
      stored: { hash: 0, shrooms: 0, coke: 0, heroin: 0 },
    });
    expect(heat.band).toBe('LOW');
  });

  it('drug lab with heroin storage is hotter', () => {
    const empty = evaluateBusinessHeat({
      businessType: 'DRUG_LAB',
      level: 1,
      assignedWorkers: 100,
      safeCash: 0,
      stored: { hash: 0, shrooms: 0, coke: 0, heroin: 0 },
    });
    const loaded = evaluateBusinessHeat({
      businessType: 'DRUG_LAB',
      level: 1,
      assignedWorkers: 100,
      safeCash: 400_000,
      stored: { hash: 0, shrooms: 0, coke: 2000, heroin: 3000 },
    });
    expect(loaded.score).toBeGreaterThan(empty.score);
    expect(loaded.band).not.toBe('LOW');
  });

  it('collecting cash lowers heat contribution', () => {
    const full = evaluateBusinessHeat({
      businessType: 'NIGHTCLUB',
      level: 1,
      assignedWorkers: 200,
      safeCash: 700_000,
      stored: { hash: 1000, shrooms: 0, coke: 0, heroin: 0 },
    });
    const emptySafe = evaluateBusinessHeat({
      businessType: 'NIGHTCLUB',
      level: 1,
      assignedWorkers: 200,
      safeCash: 0,
      stored: { hash: 1000, shrooms: 0, coke: 0, heroin: 0 },
    });
    expect(emptySafe.score).toBeLessThan(full.score);
  });
});

describe('police raids', () => {
  it('does not reroll within same 6-hour block', () => {
    const t = new Date('2026-08-13T10:00:00Z');
    const last = new Date('2026-08-13T08:00:00Z');
    expect(shouldRunRaidCheck(last, t)).toBe(false);
    expect(raidCheckBlockIndex(last)).toBe(raidCheckBlockIndex(t));
  });

  it('checks once per new block', () => {
    const t = new Date('2026-08-13T13:00:00Z');
    const last = new Date('2026-08-13T08:00:00Z');
    expect(shouldRunRaidCheck(last, t)).toBe(true);
  });

  it('empty assets never raid even on forced roll 0', () => {
    const heat = evaluateBusinessHeat({
      businessType: 'DRUG_LAB',
      level: 1,
      assignedWorkers: 0,
      safeCash: 0,
      stored: { hash: 0, shrooms: 0, coke: 0, heroin: 0 },
    });
    const result = resolveBusinessRaidCheck({
      businessId: 'biz1',
      heat,
      safeCash: 0,
      stored: { hash: 0, shrooms: 0, coke: 0, heroin: 0 },
      lastRaidCheckAt: new Date('2026-08-13T00:00:00Z'),
      now: new Date('2026-08-13T07:00:00Z'),
      roll: 0,
    });
    expect(result.raided).toBe(false);
  });

  it('applies loss fraction without going negative', () => {
    const heat = evaluateBusinessHeat({
      businessType: 'DRUG_LAB',
      level: 1,
      assignedWorkers: 500,
      safeCash: 100_000,
      stored: { hash: 0, shrooms: 0, coke: 5000, heroin: 2000 },
    });
    const result = resolveBusinessRaidCheck({
      businessId: 'biz2',
      heat,
      safeCash: 100_000,
      stored: { hash: 0, shrooms: 0, coke: 5000, heroin: 2000 },
      lastRaidCheckAt: new Date('2026-08-13T00:00:00Z'),
      now: new Date('2026-08-13T07:00:00Z'),
      roll: 0,
    });
    expect(result.raided).toBe(true);
    expect(result.losses.cashSeized).toBeGreaterThan(0);
    expect(result.losses.cashSeized).toBeLessThanOrEqual(100_000);
  });
});

describe('business street net worth', () => {
  it('nightclub purchase converts half cash NW to business asset NW', () => {
    const before = calculateCanonicalNetWorthFromPlayer({
      ...basePlayer,
      cash: 2_000_000,
    });
    const after = calculateCanonicalNetWorthFromPlayer(
      { ...basePlayer, cash: 0 },
      {
        streetWorkers: basePlayer.prostitutes,
        assignedWorkers: 0,
        businessStreetAssets: businessStreetNwContribution(2_000_000),
      },
    );
    expect(before).toBe(2_000_000 + 500 * 1750 + 100 * 700 + 5 * 2000 + 1500 * 5);
    expect(after).toBe(before - 1_000_000);
  });

  it('assigned workers still count toward NW', () => {
    const withoutAssign = calculateCanonicalNetWorthFromPlayer(basePlayer, {
      streetWorkers: 400,
      assignedWorkers: 100,
      businessStreetAssets: 1_000_000,
    });
    const allStreet = calculateCanonicalNetWorthFromPlayer(
      { ...basePlayer, prostitutes: 500 },
      {
        streetWorkers: 500,
        assignedWorkers: 0,
        businessStreetAssets: 1_000_000,
      },
    );
    expect(withoutAssign).toBe(allStreet);
  });

  it('stored drugs removed from street inventory reduce NW until withdrawn', () => {
    const withDrugs = calculateCanonicalNetWorthFromPlayer(basePlayer);
    const storedOffStreet = calculateCanonicalNetWorthFromPlayer({
      ...basePlayer,
      coke: 0,
      hash: 0,
    });
    expect(withDrugs - storedOffStreet).toBe(1500 * 5);
  });

  it('aggregate business context sums assigned workers, security, and assets', () => {
    const ctx = aggregateBusinessNwContext([
      { businessType: 'WAREHOUSE', level: 1, assignedWorkers: 200, assignedThugs: 5 },
      { businessType: 'WAREHOUSE', level: 2, assignedWorkers: 300, assignedThugs: 10 },
    ]);
    expect(ctx.assignedWorkers).toBe(500);
    expect(ctx.assignedSecurityThugs).toBe(15);
    expect(ctx.businessStreetAssets).toBe(
      getBusinessStreetNwAsset('WAREHOUSE', 1) + getBusinessStreetNwAsset('WAREHOUSE', 2),
    );
  });
});

describe('overall heat band', () => {
  it('uses max business heat', () => {
    expect(overallHeatBand([10, 55, 30])).toBe('HIGH');
  });
});
