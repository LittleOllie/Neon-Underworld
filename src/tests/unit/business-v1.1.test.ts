import { describe, it, expect } from 'vitest';
import {
  MAX_BUSINESSES_PER_PLAYER,
  businessPurchasePrice,
  businessHourlyIncome,
  effectivePassiveWorkers,
  getBusinessInvestedValue,
  getBusinessStreetNwAsset,
  getBusinessUpgradeCost,
} from '@/config/game/business-rules';
import {
  getBusinessDrugProductionBonus,
  getBusinessLevelStats,
  MAX_DRUG_LAB_PRODUCE_BONUS,
} from '@/config/game/business-levels';
import {
  securityCoverage,
  securityRaidChanceMultiplier,
  securityRaidLossMultiplier,
  securityHeatContribution,
  securityStatusBand,
} from '@/lib/game-engine/business/security';
import { settleBusinessIncome } from '@/lib/game-engine/business/settlement';
import {
  validateAssignWorkers,
  validateAssignSecurity,
  validateUpgrade,
} from '@/server/services/business.service';
import { resolveProduction } from '@/lib/game-engine/production';

describe('V1.1 base prices', () => {
  it('uses canonical purchase prices', () => {
    expect(businessPurchasePrice('WAREHOUSE')).toBe(2_500_000);
    expect(businessPurchasePrice('NIGHTCLUB')).toBe(5_000_000);
    expect(businessPurchasePrice('DRUG_LAB')).toBe(7_500_000);
  });

  it('max businesses is 8', () => {
    expect(MAX_BUSINESSES_PER_PLAYER).toBe(8);
  });
});

describe('V1.1 upgrade costs', () => {
  it('escalates by 60/100/180/300% of base for nightclub', () => {
    expect(getBusinessUpgradeCost('NIGHTCLUB', 2)).toBe(3_000_000);
    expect(getBusinessUpgradeCost('NIGHTCLUB', 3)).toBe(5_000_000);
    expect(getBusinessUpgradeCost('NIGHTCLUB', 4)).toBe(9_000_000);
    expect(getBusinessUpgradeCost('NIGHTCLUB', 5)).toBe(15_000_000);
  });

  it('total invested at L3 nightclub is $13M', () => {
    expect(getBusinessInvestedValue('NIGHTCLUB', 3)).toBe(13_000_000);
    expect(getBusinessStreetNwAsset('NIGHTCLUB', 3)).toBe(6_500_000);
  });

  it('cannot upgrade beyond L5', () => {
    expect(validateUpgrade(5, 100_000_000, 'NIGHTCLUB')).toMatch(/maximum level/i);
  });

  it('requires sufficient cash', () => {
    expect(validateUpgrade(1, 1_000_000, 'NIGHTCLUB')).toMatch(/insufficient/i);
  });
});

describe('V1.1 level caps', () => {
  it('nightclub L1 safe is $1M, L5 is $2.5M', () => {
    expect(getBusinessLevelStats('NIGHTCLUB', 1).safeCapacity).toBe(1_000_000);
    expect(getBusinessLevelStats('NIGHTCLUB', 5).safeCapacity).toBe(2_500_000);
  });

  it('warehouse L5 storage is 75k', () => {
    expect(getBusinessLevelStats('WAREHOUSE', 5).drugStorageCapacity).toBe(75_000);
  });

  it('nightclub L5 storage is 25k', () => {
    expect(getBusinessLevelStats('NIGHTCLUB', 5).drugStorageCapacity).toBe(25_000);
  });

  it('drug lab L5 storage is 50k', () => {
    expect(getBusinessLevelStats('DRUG_LAB', 5).drugStorageCapacity).toBe(50_000);
  });

  it('nightclub L5 worker cap is 2000', () => {
    expect(getBusinessLevelStats('NIGHTCLUB', 5).workerCapacity).toBe(2000);
  });
});

describe('V1.1 worker capacity', () => {
  it('blocks assignment when at cap', () => {
    expect(validateAssignWorkers(100, 10, 600, 600)).toMatch(/full/i);
  });

  it('blocks assignment beyond remaining slots', () => {
    expect(validateAssignWorkers(100, 50, 580, 600)).toMatch(/only 20/i);
  });

  it('clamps passive income for over-cap legacy workers', () => {
    expect(effectivePassiveWorkers(1450, 600)).toBe(600);
    const income = businessHourlyIncome('NIGHTCLUB', 1450, 1);
    expect(income).toBe(businessHourlyIncome('NIGHTCLUB', 600, 1));
  });

  it('L2 nightclub income bonus applies at level', () => {
    const l1 = businessHourlyIncome('NIGHTCLUB', 100, 1);
    const l2 = businessHourlyIncome('NIGHTCLUB', 100, 2);
    expect(l2).toBeGreaterThan(l1);
  });
});

describe('V1.1 security', () => {
  it('coverage scales with assigned / capacity', () => {
    expect(securityCoverage(50, 100)).toBe(0.5);
    expect(securityCoverage(150, 100)).toBe(1);
  });

  it('status bands match spec', () => {
    expect(securityStatusBand(0)).toBe('NONE');
    expect(securityStatusBand(0.1)).toBe('LIGHT');
    expect(securityStatusBand(0.3)).toBe('MODERATE');
    expect(securityStatusBand(0.6)).toBe('STRONG');
    expect(securityStatusBand(0.9)).toBe('HEAVY');
  });

  it('raid chance reduction caps at 35% combined', () => {
    const mult = securityRaidChanceMultiplier(1, { levelRaidChanceReduction: 0.1 });
    expect(mult).toBeGreaterThanOrEqual(0.65);
  });

  it('raid loss reduction caps at 40% combined', () => {
    const mult = securityRaidLossMultiplier(1, { levelSecurityLossReduction: 0.05 });
    expect(mult).toBeGreaterThanOrEqual(0.6);
  });

  it('security heat increases with coverage', () => {
    expect(securityHeatContribution(0, 100)).toBe(0);
    expect(securityHeatContribution(100, 100)).toBeGreaterThan(0);
  });

  it('blocks security assignment over capacity', () => {
    expect(validateAssignSecurity(50, 10, 100, 100)).toMatch(/full/i);
  });
});

describe('V1.1 drug lab produce bonus', () => {
  it('single L1 lab gives 2%', () => {
    expect(
      getBusinessDrugProductionBonus([{ businessType: 'DRUG_LAB', level: 1 }]),
    ).toBeCloseTo(0.02, 5);
  });

  it('L5 lab gives 12%', () => {
    expect(
      getBusinessDrugProductionBonus([{ businessType: 'DRUG_LAB', level: 5 }]),
    ).toBeCloseTo(0.12, 5);
  });

  it('multiple labs use diminishing returns with 20% cap', () => {
    const bonus = getBusinessDrugProductionBonus([
      { businessType: 'DRUG_LAB', level: 5 },
      { businessType: 'DRUG_LAB', level: 5 },
      { businessType: 'DRUG_LAB', level: 5 },
      { businessType: 'DRUG_LAB', level: 5 },
    ]);
    expect(bonus).toBeLessThanOrEqual(MAX_DRUG_LAB_PRODUCE_BONUS);
    expect(bonus).toBeCloseTo(0.162, 3);
  });

  it('applies to thug drug production only', () => {
    const base = resolveProduction({
      turnsSpent: 100,
      thugCount: 50,
      prostituteCount: 500,
      prostitutePayoutPercent: 50,
      drugType: 'coke',
      thugHappiness: 80,
      prostituteHappiness: 80,
      seed: 42,
      drugProductionBonus: 0,
    });
    const boosted = resolveProduction({
      turnsSpent: 100,
      thugCount: 50,
      prostituteCount: 500,
      prostitutePayoutPercent: 50,
      drugType: 'coke',
      thugHappiness: 80,
      prostituteHappiness: 80,
      seed: 42,
      drugProductionBonus: 0.06,
    });
    expect(boosted.drugUnitsProduced).toBeGreaterThan(base.drugUnitsProduced);
    expect(boosted.cashEarned).toBe(base.cashEarned);
    expect(boosted.businessBonusUnits).toBeGreaterThan(0);
  });
});

describe('V1.1 safe fill behaviour', () => {
  it('pauses income when safe is full without overflow accrual', () => {
    const cap = getBusinessLevelStats('NIGHTCLUB', 1).safeCapacity;
    const result = settleBusinessIncome({
      businessType: 'NIGHTCLUB',
      level: 1,
      assignedWorkers: 600,
      safeCash: cap,
      lastSettledAt: new Date('2026-08-13T00:00:00Z'),
      now: new Date('2026-08-14T00:00:00Z'),
    });
    expect(result.safeCash).toBe(cap);
    expect(result.incomeAccrued).toBe(0);
    expect(result.safeFull).toBe(true);
  });
});

describe('V1.1 canonical NW', () => {
  it('nightclub L1 street asset is $2.5M regardless of legacy purchase price', () => {
    expect(getBusinessStreetNwAsset('NIGHTCLUB', 1)).toBe(2_500_000);
  });

  it('nightclub L2 street asset is 50% of $8M invested', () => {
    expect(getBusinessStreetNwAsset('NIGHTCLUB', 2)).toBe(4_000_000);
  });
});
