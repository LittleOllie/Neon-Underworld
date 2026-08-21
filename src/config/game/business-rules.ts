import { REDLITE_PRODUCTION, REDLITE_TURNS } from './redlite-rules';
import {
  BUSINESS_LEVEL_TABLES,
  BUSINESS_UPGRADE_COST_FRACTION,
  clampBusinessLevel,
  getBusinessLevelStats,
  type BusinessUpgradeLevel,
} from './business-levels';

/** Max owned businesses per player (abuse guard). */
export const MAX_BUSINESSES_PER_PLAYER = 8;

/** Purchase price counts toward Street NW at this fraction. */
export const BUSINESS_STREET_NW_MULTIPLIER = 0.5;

/** Passive income = this fraction of active Produce worker gross per turn. */
export const BUSINESS_PASSIVE_INCOME_FRACTION = 0.2;

export const BUSINESS_TYPES = ['NIGHTCLUB', 'WAREHOUSE', 'DRUG_LAB'] as const;
export type BusinessType = (typeof BUSINESS_TYPES)[number];

export interface BusinessTypeRule {
  type: BusinessType;
  displayName: string;
  purchasePrice: number;
  passiveIncomeMultiplier: number;
  baseHeat: number;
  blurb: string;
  /** L1 caps — use getBusinessLevelStats for level-specific values. */
  safeCapacity: number;
  drugStorageCapacity: number;
  workerCapacity: number;
  securityCapacity: number;
}

export const BUSINESS_TYPE_RULES: Record<BusinessType, BusinessTypeRule> = {
  WAREHOUSE: {
    type: 'WAREHOUSE',
    displayName: 'Depot',
    purchasePrice: 2_500_000,
    passiveIncomeMultiplier: 0.25,
    baseHeat: 8,
    blurb: 'Storage and logistics-focused Business with lower Trace.',
    ...pickL1Caps('WAREHOUSE'),
  },
  NIGHTCLUB: {
    type: 'NIGHTCLUB',
    displayName: 'Club',
    purchasePrice: 5_000_000,
    passiveIncomeMultiplier: 1.0,
    baseHeat: 22,
    blurb: 'Cash-producing underground venue.',
    ...pickL1Caps('NIGHTCLUB'),
  },
  DRUG_LAB: {
    type: 'DRUG_LAB',
    displayName: 'Workshop',
    purchasePrice: 7_500_000,
    passiveIncomeMultiplier: 0.5,
    baseHeat: 38,
    blurb: 'Production-focused underground technology operation.',
    ...pickL1Caps('DRUG_LAB'),
  },
};

function pickL1Caps(type: BusinessType) {
  const l1 = getBusinessLevelStats(type, 1);
  return {
    safeCapacity: l1.safeCapacity,
    drugStorageCapacity: l1.drugStorageCapacity,
    workerCapacity: l1.workerCapacity,
    securityCapacity: l1.securityCapacity,
  };
}

export const BUSINESS_DRUG_KEYS = ['hash', 'shrooms', 'coke', 'heroin'] as const;
export type BusinessDrugKey = (typeof BUSINESS_DRUG_KEYS)[number];

export const BUSINESS_DRUG_HEAT_WEIGHT: Record<BusinessDrugKey, number> = {
  hash: 1,
  shrooms: 1.5,
  coke: 2.5,
  heroin: 3,
};

export const BUSINESS_HEAT_BANDS = {
  LOW: { min: 0, max: 24, label: 'LOW' as const },
  MODERATE: { min: 25, max: 49, label: 'MODERATE' as const },
  HIGH: { min: 50, max: 74, label: 'HIGH' as const },
  CRITICAL: { min: 75, max: 100, label: 'CRITICAL' as const },
} as const;

export type BusinessHeatBand = keyof typeof BUSINESS_HEAT_BANDS;

export const BUSINESS_RAID_CHANCE_PER_CHECK: Record<BusinessHeatBand, number> = {
  LOW: 0.005 / 4,
  MODERATE: 0.02 / 4,
  HIGH: 0.06 / 4,
  CRITICAL: 0.12 / 4,
};

export const BUSINESS_RAID_LOSS_FRACTION: Record<BusinessHeatBand, number> = {
  LOW: 0.1,
  MODERATE: 0.1,
  HIGH: 0.15,
  CRITICAL: 0.2,
};

export const BUSINESS_RAID_CHECK_INTERVAL_MS = 6 * 60 * 60 * 1000;

export const BUSINESS_ACTIVE_WORKER_CASH_PER_TURN =
  REDLITE_PRODUCTION.cashPerProstitutePerTurn;

export const BUSINESS_TURNS_PER_HOUR = REDLITE_TURNS.regenerationRatePerHour;

export function getBusinessTypeRule(type: BusinessType): BusinessTypeRule {
  return BUSINESS_TYPE_RULES[type];
}

export function businessPurchasePrice(type: BusinessType): number {
  return getBusinessTypeRule(type).purchasePrice;
}

export function getBusinessUpgradeCost(type: BusinessType, targetLevel: number): number {
  const level = clampBusinessLevel(targetLevel);
  if (level < 2 || level > 5) {
    throw new Error(`Invalid upgrade target level: ${targetLevel}`);
  }
  const fraction = BUSINESS_UPGRADE_COST_FRACTION[level as BusinessUpgradeLevel];
  return Math.floor(businessPurchasePrice(type) * fraction);
}

/** Total cash invested in purchase + completed upgrades for canonical valuation. */
export function getBusinessInvestedValue(type: BusinessType, level: number): number {
  const clamped = clampBusinessLevel(level);
  let total = businessPurchasePrice(type);
  for (let l = 2; l <= clamped; l++) {
    total += getBusinessUpgradeCost(type, l);
  }
  return total;
}

export function getBusinessStreetNwAsset(type: BusinessType, level: number): number {
  return Math.floor(getBusinessInvestedValue(type, level) * BUSINESS_STREET_NW_MULTIPLIER);
}

export interface BusinessInvestmentState {
  businessType: BusinessType;
  /** Completed functional level — caps/income use this until upgrade finishes. */
  level: number;
  upgradeTargetLevel?: number | null;
}

/** Paid investment level — includes in-progress upgrade target once payment is made. */
export function getBusinessPaidInvestmentLevel(state: BusinessInvestmentState): number {
  if (
    state.upgradeTargetLevel != null &&
    state.upgradeTargetLevel > state.level
  ) {
    return state.upgradeTargetLevel;
  }
  return state.level;
}

export function getBusinessInvestedValueForState(state: BusinessInvestmentState): number {
  return getBusinessInvestedValue(
    state.businessType,
    getBusinessPaidInvestmentLevel(state),
  );
}

export function getBusinessStreetNwAssetForState(state: BusinessInvestmentState): number {
  return Math.floor(
    getBusinessInvestedValueForState(state) * BUSINESS_STREET_NW_MULTIPLIER,
  );
}

export function isBusinessUpgrading(row: {
  upgradeTargetLevel?: number | null;
  upgradeCompletesAt?: Date | null;
}): boolean {
  return row.upgradeTargetLevel != null && row.upgradeCompletesAt != null;
}

/** @deprecated Use getBusinessStreetNwAsset(type, level) for canonical NW. */
export function businessStreetNwContribution(purchasePrice: number): number {
  return Math.floor(purchasePrice * BUSINESS_STREET_NW_MULTIPLIER);
}

export function effectivePassiveWorkers(assignedWorkers: number, workerCapacity: number): number {
  return Math.min(Math.max(0, assignedWorkers), Math.max(0, workerCapacity));
}

export function isWorkerOverCapacity(assignedWorkers: number, workerCapacity: number): boolean {
  return assignedWorkers > workerCapacity;
}

export function isSecurityOverCapacity(assignedThugs: number, securityCapacity: number): boolean {
  return assignedThugs > securityCapacity;
}

export function businessHourlyIncomePerWorker(
  type: BusinessType,
  level: number = 1,
): number {
  const stats = getBusinessLevelStats(type, level);
  const activePerWorkerPerHour =
    BUSINESS_ACTIVE_WORKER_CASH_PER_TURN * BUSINESS_TURNS_PER_HOUR;
  return (
    activePerWorkerPerHour *
    BUSINESS_PASSIVE_INCOME_FRACTION *
    stats.passiveIncomeMultiplier
  );
}

export function businessHourlyIncome(
  type: BusinessType,
  assignedWorkers: number,
  level: number = 1,
): number {
  const stats = getBusinessLevelStats(type, level);
  const workers = effectivePassiveWorkers(assignedWorkers, stats.workerCapacity);
  if (workers <= 0) return 0;
  return Math.floor(businessHourlyIncomePerWorker(type, level) * workers);
}

export function defaultBusinessName(type: BusinessType, sequence: number): string {
  return `${getBusinessTypeRule(type).displayName} #${sequence}`;
}

export function businessDrugStorageTotal(stored: Record<BusinessDrugKey, number>): number {
  return stored.hash + stored.shrooms + stored.coke + stored.heroin;
}

export function businessWeightedDrugUnits(
  stored: Record<BusinessDrugKey, number>,
  premiumDrugHeatMultiplier = 1,
): number {
  const cokeWeight = BUSINESS_DRUG_HEAT_WEIGHT.coke * premiumDrugHeatMultiplier;
  const heroinWeight = BUSINESS_DRUG_HEAT_WEIGHT.heroin * premiumDrugHeatMultiplier;
  return (
    stored.hash * BUSINESS_DRUG_HEAT_WEIGHT.hash +
    stored.shrooms * BUSINESS_DRUG_HEAT_WEIGHT.shrooms +
    stored.coke * cokeWeight +
    stored.heroin * heroinWeight
  );
}

export { BUSINESS_LEVEL_TABLES, getBusinessLevelStats, clampBusinessLevel } from './business-levels';
export {
  calculateBusinessNetworkBonus,
  formatRecruitmentBonusDisplay,
  getBusinessTierRecruitmentContribution,
  MAX_THUG_RECRUITMENT_BONUS_PERCENT,
  MAX_WORKER_RECRUITMENT_BONUS_PERCENT,
  RECRUITMENT_STACK_WEIGHTS,
  stackRecruitmentContributions,
} from './business-recruitment-rules';
export {
  getBusinessDrugProductionBonus,
  MAX_DRUG_LAB_PRODUCE_BONUS,
  getBusinessUpgradeDurationMs,
  getBusinessUpgradeDurationLabel,
  BUSINESS_UPGRADE_DURATION_MS,
} from './business-levels';

/** Future Total Empire Value helper — not used for live rankings in V1.1. */
export function calculateTotalEmpireValue(input: {
  streetNetWorth: number;
  businessSafeCash: number;
  businessStoredDrugUnits: number;
}): number {
  return (
    input.streetNetWorth +
    input.businessSafeCash +
    input.businessStoredDrugUnits * 5
  );
}
