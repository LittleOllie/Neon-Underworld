import { REDLITE_PRODUCTION, REDLITE_TURNS } from './redlite-rules';

/** Max owned businesses per player (abuse guard). */
export const MAX_BUSINESSES_PER_PLAYER = 10;

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
  safeCapacity: number;
  drugStorageCapacity: number;
  /** Base heat score (0–100 scale contribution). */
  baseHeat: number;
  blurb: string;
}

export const BUSINESS_TYPE_RULES: Record<BusinessType, BusinessTypeRule> = {
  WAREHOUSE: {
    type: 'WAREHOUSE',
    displayName: 'Warehouse',
    purchasePrice: 1_000_000,
    passiveIncomeMultiplier: 0.25,
    safeCapacity: 250_000,
    drugStorageCapacity: 25_000,
    baseHeat: 8,
    blurb: 'Low heat · high storage · low income',
  },
  NIGHTCLUB: {
    type: 'NIGHTCLUB',
    displayName: 'Nightclub',
    purchasePrice: 2_000_000,
    passiveIncomeMultiplier: 1.0,
    safeCapacity: 750_000,
    drugStorageCapacity: 5_000,
    baseHeat: 22,
    blurb: 'High worker income · moderate storage · moderate heat',
  },
  DRUG_LAB: {
    type: 'DRUG_LAB',
    displayName: 'Drug Lab',
    purchasePrice: 3_500_000,
    passiveIncomeMultiplier: 0.5,
    safeCapacity: 500_000,
    drugStorageCapacity: 15_000,
    baseHeat: 38,
    blurb: 'Drug-focused · high storage · high heat',
  },
};

export const BUSINESS_DRUG_KEYS = ['hash', 'shrooms', 'coke', 'heroin'] as const;
export type BusinessDrugKey = (typeof BUSINESS_DRUG_KEYS)[number];

/** Heat weight per stored drug unit (relative to hash). */
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

/** Raid probability per 6-hour check block, by heat band (daily targets ÷ 4). */
export const BUSINESS_RAID_CHANCE_PER_CHECK: Record<BusinessHeatBand, number> = {
  LOW: 0.005 / 4,
  MODERATE: 0.02 / 4,
  HIGH: 0.06 / 4,
  CRITICAL: 0.12 / 4,
};

/** Asset loss fraction when raided, by heat band at check time. */
export const BUSINESS_RAID_LOSS_FRACTION: Record<BusinessHeatBand, number> = {
  LOW: 0.1,
  MODERATE: 0.1,
  HIGH: 0.15,
  CRITICAL: 0.2,
};

/** Minimum ms between police raid eligibility checks. */
export const BUSINESS_RAID_CHECK_INTERVAL_MS = 6 * 60 * 60 * 1000;

const MS_PER_HOUR = 60 * 60 * 1000;

/** Gross $/worker/turn from Produce — passive uses 20% of this. */
export const BUSINESS_ACTIVE_WORKER_CASH_PER_TURN =
  REDLITE_PRODUCTION.cashPerProstitutePerTurn;

/** Turns regenerated per hour (~24). */
export const BUSINESS_TURNS_PER_HOUR = REDLITE_TURNS.regenerationRatePerHour;

export function getBusinessTypeRule(type: BusinessType): BusinessTypeRule {
  return BUSINESS_TYPE_RULES[type];
}

export function businessPurchasePrice(type: BusinessType): number {
  return getBusinessTypeRule(type).purchasePrice;
}

export function businessStreetNwContribution(purchasePrice: number): number {
  return Math.floor(purchasePrice * BUSINESS_STREET_NW_MULTIPLIER);
}

/** Hourly passive cash per assigned worker for a business type (before safe cap). */
export function businessHourlyIncomePerWorker(type: BusinessType): number {
  const rule = getBusinessTypeRule(type);
  const activePerWorkerPerHour =
    BUSINESS_ACTIVE_WORKER_CASH_PER_TURN * BUSINESS_TURNS_PER_HOUR;
  return (
    activePerWorkerPerHour *
    BUSINESS_PASSIVE_INCOME_FRACTION *
    rule.passiveIncomeMultiplier
  );
}

export function businessHourlyIncome(type: BusinessType, assignedWorkers: number): number {
  if (assignedWorkers <= 0) return 0;
  return Math.floor(businessHourlyIncomePerWorker(type) * assignedWorkers);
}

export function defaultBusinessName(type: BusinessType, sequence: number): string {
  return `${getBusinessTypeRule(type).displayName} #${sequence}`;
}

export function businessDrugStorageTotal(stored: Record<BusinessDrugKey, number>): number {
  return stored.hash + stored.shrooms + stored.coke + stored.heroin;
}

export function businessWeightedDrugUnits(stored: Record<BusinessDrugKey, number>): number {
  return (
    stored.hash * BUSINESS_DRUG_HEAT_WEIGHT.hash +
    stored.shrooms * BUSINESS_DRUG_HEAT_WEIGHT.shrooms +
    stored.coke * BUSINESS_DRUG_HEAT_WEIGHT.coke +
    stored.heroin * BUSINESS_DRUG_HEAT_WEIGHT.heroin
  );
}
