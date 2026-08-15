import type { BusinessType } from '@prisma/client';
import { getBusinessLevelStats } from './business-levels';

/** Percent-point contribution from a single business tier (before portfolio stacking). */
export interface BusinessTierRecruitmentContribution {
  workerPercent: number;
  thugPercent: number;
}

export interface BusinessNetworkBonus {
  workerBonusPercent: number;
  thugBonusPercent: number;
  workerMultiplier: number;
  thugMultiplier: number;
  totalWorkerCapacity: number;
}

/** Warehouse — primarily Worker recruitment. */
const WAREHOUSE_WORKER_TIER_PERCENT: Record<number, number> = {
  1: 5,
  2: 8,
  3: 12,
  4: 18,
  5: 26,
};

/** Nightclub — balanced Worker + Thug recruitment. */
const NIGHTCLUB_WORKER_TIER_PERCENT: Record<number, number> = {
  1: 3,
  2: 5,
  3: 8,
  4: 13,
  5: 20,
};

const NIGHTCLUB_THUG_TIER_PERCENT: Record<number, number> = {
  1: 3,
  2: 5,
  3: 8,
  4: 13,
  5: 20,
};

/** Drug Lab — primarily Thug recruitment (Produce bonus unchanged elsewhere). */
const DRUG_LAB_THUG_TIER_PERCENT: Record<number, number> = {
  1: 5,
  2: 8,
  3: 12,
  4: 18,
  5: 26,
};

/** Diminishing returns when stacking multiple businesses (same resource type pool). */
export const RECRUITMENT_STACK_WEIGHTS = [1, 0.35, 0.18, 0.1, 0.06, 0.04, 0.03, 0.02] as const;

/** Hard cap on stacked recruitment bonus (+125% = 2.25× multiplier). */
export const MAX_WORKER_RECRUITMENT_BONUS_PERCENT = 125;
export const MAX_THUG_RECRUITMENT_BONUS_PERCENT = 125;

export function getBusinessTierRecruitmentContribution(
  type: BusinessType,
  level: number,
): BusinessTierRecruitmentContribution {
  const tier = Math.max(1, Math.min(5, Math.floor(level)));
  switch (type) {
    case 'WAREHOUSE':
      return { workerPercent: WAREHOUSE_WORKER_TIER_PERCENT[tier] ?? 0, thugPercent: 0 };
    case 'NIGHTCLUB':
      return {
        workerPercent: NIGHTCLUB_WORKER_TIER_PERCENT[tier] ?? 0,
        thugPercent: NIGHTCLUB_THUG_TIER_PERCENT[tier] ?? 0,
      };
    case 'DRUG_LAB':
      return { workerPercent: 0, thugPercent: DRUG_LAB_THUG_TIER_PERCENT[tier] ?? 0 };
    default:
      return { workerPercent: 0, thugPercent: 0 };
  }
}

export function stackRecruitmentContributions(contributions: number[]): number {
  const sorted = contributions.filter((value) => value > 0).sort((a, b) => b - a);
  let total = 0;
  for (let i = 0; i < sorted.length; i++) {
    total += sorted[i]! * (RECRUITMENT_STACK_WEIGHTS[i] ?? 0);
  }
  return total;
}

export function recruitmentBonusMultiplier(bonusPercent: number): number {
  return 1 + bonusPercent / 100;
}

export function formatRecruitmentBonusDisplay(bonusPercent: number): string {
  if (bonusPercent <= 0) return 'None';
  const rounded = Math.round(bonusPercent);
  return rounded === bonusPercent ? `+${rounded}%` : `+${bonusPercent.toFixed(1)}%`;
}

export function calculateBusinessNetworkBonus(
  businesses: Array<{ businessType: BusinessType; level: number }>,
): BusinessNetworkBonus {
  const workerContributions: number[] = [];
  const thugContributions: number[] = [];
  let totalWorkerCapacity = 0;

  for (const business of businesses) {
    const tier = getBusinessTierRecruitmentContribution(business.businessType, business.level);
    if (tier.workerPercent > 0) workerContributions.push(tier.workerPercent);
    if (tier.thugPercent > 0) thugContributions.push(tier.thugPercent);
    totalWorkerCapacity += getBusinessLevelStats(business.businessType, business.level).workerCapacity;
  }

  const workerBonusPercent = Math.min(
    MAX_WORKER_RECRUITMENT_BONUS_PERCENT,
    stackRecruitmentContributions(workerContributions),
  );
  const thugBonusPercent = Math.min(
    MAX_THUG_RECRUITMENT_BONUS_PERCENT,
    stackRecruitmentContributions(thugContributions),
  );

  return {
    workerBonusPercent,
    thugBonusPercent,
    workerMultiplier: recruitmentBonusMultiplier(workerBonusPercent),
    thugMultiplier: recruitmentBonusMultiplier(thugBonusPercent),
    totalWorkerCapacity,
  };
}
