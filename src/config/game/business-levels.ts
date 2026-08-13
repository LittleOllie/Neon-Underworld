import type { BusinessType } from './business-rules';

/** Upgrade cost as fraction of base purchase price (target level). */
export const BUSINESS_UPGRADE_COST_FRACTION = {
  2: 0.6,
  3: 1.0,
  4: 1.8,
  5: 3.0,
} as const;

export type BusinessUpgradeLevel = 2 | 3 | 4 | 5;

export interface BusinessLevelStats {
  level: number;
  workerCapacity: number;
  securityCapacity: number;
  safeCapacity: number;
  drugStorageCapacity: number;
  /** Effective passive income multiplier for this level (includes Nightclub bonuses). */
  passiveIncomeMultiplier: number;
  /** Total Produce drug yield bonus for Drug Lab at this level (0–0.12). */
  produceYieldBonus: number;
  /** Fraction reduction on storage-driven heat (Warehouse). 0–0.15 */
  storageHeatReduction: number;
  /** Relative raid chance reduction from level (Warehouse L4). 0–0.10 */
  levelRaidChanceReduction: number;
  /** Extra raid loss reduction from level security upgrade (L3). 0–0.05 */
  levelSecurityLossReduction: number;
  /** Multiplier on coke/heroin heat weights (Drug Lab L4+). 1.0 = normal */
  premiumDrugHeatMultiplier: number;
}

const WAREHOUSE_LEVELS: BusinessLevelStats[] = [
  {
    level: 1,
    workerCapacity: 500,
    securityCapacity: 50,
    safeCapacity: 350_000,
    drugStorageCapacity: 20_000,
    passiveIncomeMultiplier: 0.25,
    produceYieldBonus: 0,
    storageHeatReduction: 0,
    levelRaidChanceReduction: 0,
    levelSecurityLossReduction: 0,
    premiumDrugHeatMultiplier: 1,
  },
  {
    level: 2,
    workerCapacity: 700,
    securityCapacity: 65,
    safeCapacity: 500_000,
    drugStorageCapacity: 30_000,
    passiveIncomeMultiplier: 0.25,
    produceYieldBonus: 0,
    storageHeatReduction: 0.05,
    levelRaidChanceReduction: 0,
    levelSecurityLossReduction: 0,
    premiumDrugHeatMultiplier: 1,
  },
  {
    level: 3,
    workerCapacity: 900,
    securityCapacity: 80,
    safeCapacity: 700_000,
    drugStorageCapacity: 45_000,
    passiveIncomeMultiplier: 0.25,
    produceYieldBonus: 0,
    storageHeatReduction: 0.08,
    levelRaidChanceReduction: 0,
    levelSecurityLossReduction: 0.05,
    premiumDrugHeatMultiplier: 1,
  },
  {
    level: 4,
    workerCapacity: 1200,
    securityCapacity: 100,
    safeCapacity: 1_000_000,
    drugStorageCapacity: 60_000,
    passiveIncomeMultiplier: 0.25,
    produceYieldBonus: 0,
    storageHeatReduction: 0.12,
    levelRaidChanceReduction: 0.1,
    levelSecurityLossReduction: 0.05,
    premiumDrugHeatMultiplier: 1,
  },
  {
    level: 5,
    workerCapacity: 1500,
    securityCapacity: 125,
    safeCapacity: 1_500_000,
    drugStorageCapacity: 75_000,
    passiveIncomeMultiplier: 0.25,
    produceYieldBonus: 0,
    storageHeatReduction: 0.15,
    levelRaidChanceReduction: 0.1,
    levelSecurityLossReduction: 0.05,
    premiumDrugHeatMultiplier: 1,
  },
];

const NIGHTCLUB_LEVELS: BusinessLevelStats[] = [
  {
    level: 1,
    workerCapacity: 600,
    securityCapacity: 100,
    safeCapacity: 1_000_000,
    drugStorageCapacity: 8_000,
    passiveIncomeMultiplier: 1.0,
    produceYieldBonus: 0,
    storageHeatReduction: 0,
    levelRaidChanceReduction: 0,
    levelSecurityLossReduction: 0,
    premiumDrugHeatMultiplier: 1,
  },
  {
    level: 2,
    workerCapacity: 800,
    securityCapacity: 115,
    safeCapacity: 1_250_000,
    drugStorageCapacity: 10_000,
    passiveIncomeMultiplier: 1.05,
    produceYieldBonus: 0,
    storageHeatReduction: 0,
    levelRaidChanceReduction: 0,
    levelSecurityLossReduction: 0,
    premiumDrugHeatMultiplier: 1,
  },
  {
    level: 3,
    workerCapacity: 1000,
    securityCapacity: 150,
    safeCapacity: 1_600_000,
    drugStorageCapacity: 13_000,
    passiveIncomeMultiplier: 1.05,
    produceYieldBonus: 0,
    storageHeatReduction: 0,
    levelRaidChanceReduction: 0,
    levelSecurityLossReduction: 0,
    premiumDrugHeatMultiplier: 1,
  },
  {
    level: 4,
    workerCapacity: 1300,
    securityCapacity: 175,
    safeCapacity: 2_100_000,
    drugStorageCapacity: 18_000,
    passiveIncomeMultiplier: 1.1,
    produceYieldBonus: 0,
    storageHeatReduction: 0,
    levelRaidChanceReduction: 0,
    levelSecurityLossReduction: 0,
    premiumDrugHeatMultiplier: 1,
  },
  {
    level: 5,
    workerCapacity: 2000,
    securityCapacity: 225,
    safeCapacity: 2_500_000,
    drugStorageCapacity: 25_000,
    passiveIncomeMultiplier: 1.1,
    produceYieldBonus: 0,
    storageHeatReduction: 0,
    levelRaidChanceReduction: 0,
    levelSecurityLossReduction: 0,
    premiumDrugHeatMultiplier: 1,
  },
];

const DRUG_LAB_LEVELS: BusinessLevelStats[] = [
  {
    level: 1,
    workerCapacity: 400,
    securityCapacity: 75,
    safeCapacity: 600_000,
    drugStorageCapacity: 12_000,
    passiveIncomeMultiplier: 0.5,
    produceYieldBonus: 0.02,
    storageHeatReduction: 0,
    levelRaidChanceReduction: 0,
    levelSecurityLossReduction: 0,
    premiumDrugHeatMultiplier: 1,
  },
  {
    level: 2,
    workerCapacity: 550,
    securityCapacity: 90,
    safeCapacity: 800_000,
    drugStorageCapacity: 20_000,
    passiveIncomeMultiplier: 0.5,
    produceYieldBonus: 0.04,
    storageHeatReduction: 0,
    levelRaidChanceReduction: 0,
    levelSecurityLossReduction: 0,
    premiumDrugHeatMultiplier: 1,
  },
  {
    level: 3,
    workerCapacity: 700,
    securityCapacity: 120,
    safeCapacity: 1_050_000,
    drugStorageCapacity: 30_000,
    passiveIncomeMultiplier: 0.5,
    produceYieldBonus: 0.06,
    storageHeatReduction: 0,
    levelRaidChanceReduction: 0,
    levelSecurityLossReduction: 0.05,
    premiumDrugHeatMultiplier: 1,
  },
  {
    level: 4,
    workerCapacity: 900,
    securityCapacity: 150,
    safeCapacity: 1_450_000,
    drugStorageCapacity: 40_000,
    passiveIncomeMultiplier: 0.5,
    produceYieldBonus: 0.09,
    storageHeatReduction: 0,
    levelRaidChanceReduction: 0,
    levelSecurityLossReduction: 0.05,
    premiumDrugHeatMultiplier: 0.9,
  },
  {
    level: 5,
    workerCapacity: 1100,
    securityCapacity: 200,
    safeCapacity: 2_050_000,
    drugStorageCapacity: 50_000,
    passiveIncomeMultiplier: 0.5,
    produceYieldBonus: 0.12,
    storageHeatReduction: 0,
    levelRaidChanceReduction: 0,
    levelSecurityLossReduction: 0.05,
    premiumDrugHeatMultiplier: 0.8,
  },
];

export const BUSINESS_LEVEL_TABLES: Record<BusinessType, BusinessLevelStats[]> = {
  WAREHOUSE: WAREHOUSE_LEVELS,
  NIGHTCLUB: NIGHTCLUB_LEVELS,
  DRUG_LAB: DRUG_LAB_LEVELS,
};

export const MAX_BUSINESS_LEVEL = 5;

/** Upgrade build time by target level (ms). Purchase to L1 remains instant. */
export const BUSINESS_UPGRADE_DURATION_MS: Record<BusinessUpgradeLevel, number> = {
  2: 2 * 60 * 60 * 1000,
  3: 6 * 60 * 60 * 1000,
  4: 12 * 60 * 60 * 1000,
  5: 24 * 60 * 60 * 1000,
};

const BUSINESS_UPGRADE_DURATION_HOURS: Record<BusinessUpgradeLevel, number> = {
  2: 2,
  3: 6,
  4: 12,
  5: 24,
};

export function getBusinessUpgradeDurationMs(targetLevel: number): number {
  const level = clampBusinessLevel(targetLevel);
  if (level < 2 || level > MAX_BUSINESS_LEVEL) {
    throw new Error(`Invalid upgrade target level for duration: ${targetLevel}`);
  }
  return BUSINESS_UPGRADE_DURATION_MS[level as BusinessUpgradeLevel];
}

export function getBusinessUpgradeDurationLabel(targetLevel: number): string {
  const level = clampBusinessLevel(targetLevel);
  if (level < 2 || level > MAX_BUSINESS_LEVEL) return '';
  const hours = BUSINESS_UPGRADE_DURATION_HOURS[level as BusinessUpgradeLevel];
  return hours === 1 ? '1 hour' : `${hours} hours`;
}

export function clampBusinessLevel(level: number): number {
  return Math.max(1, Math.min(MAX_BUSINESS_LEVEL, Math.floor(level)));
}

export function getBusinessLevelStats(type: BusinessType, level: number): BusinessLevelStats {
  const clamped = clampBusinessLevel(level);
  return BUSINESS_LEVEL_TABLES[type][clamped - 1]!;
}

/** Diminishing returns for multiple Drug Labs — hard cap 20%. */
export const DRUG_LAB_BONUS_STACK_WEIGHTS = [1, 0.25, 0.1] as const;
export const MAX_DRUG_LAB_PRODUCE_BONUS = 0.2;

export function getBusinessDrugProductionBonus(
  labs: Array<{ businessType: BusinessType; level: number }>,
): number {
  const bonuses = labs
    .filter((l) => l.businessType === 'DRUG_LAB')
    .map((l) => getBusinessLevelStats('DRUG_LAB', l.level).produceYieldBonus)
    .sort((a, b) => b - a);

  let total = 0;
  for (let i = 0; i < bonuses.length; i++) {
    const weight = DRUG_LAB_BONUS_STACK_WEIGHTS[i] ?? 0;
    total += bonuses[i]! * weight;
  }
  return Math.min(MAX_DRUG_LAB_PRODUCE_BONUS, total);
}
