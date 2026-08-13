import {
  BUSINESS_RAID_CHANCE_PER_CHECK,
  BUSINESS_RAID_CHECK_INTERVAL_MS,
  BUSINESS_RAID_LOSS_FRACTION,
  type BusinessDrugKey,
  type BusinessHeatBand,
} from '@/config/game/business-rules';
import type { BusinessHeatResult } from './heat';

export interface BusinessRaidInput {
  businessId: string;
  heat: BusinessHeatResult;
  safeCash: number;
  stored: Record<BusinessDrugKey, number>;
  lastRaidCheckAt: Date;
  now?: Date;
  /** Relative multiplier on raid chance (from security + level). Default 1. */
  raidChanceMultiplier?: number;
  /** Relative multiplier on losses when raided (from security + level). Default 1. */
  raidLossMultiplier?: number;
  /** 0–1 roll — inject for tests. */
  roll?: number;
}

export interface BusinessRaidLosses {
  cashSeized: number;
  drugsSeized: Record<BusinessDrugKey, number>;
}

export interface BusinessRaidResult {
  checked: boolean;
  raided: boolean;
  losses: BusinessRaidLosses;
  nextLastRaidCheckAt: Date;
}

function emptyLosses(): BusinessRaidLosses {
  return { cashSeized: 0, drugsSeized: { hash: 0, shrooms: 0, coke: 0, heroin: 0 } };
}

/** Deterministic roll from business id + check block index (stable within interval). */
export function raidCheckRoll(businessId: string, blockIndex: number): number {
  let hash = 2166136261;
  const seed = `${businessId}:${blockIndex}`;
  for (let i = 0; i < seed.length; i++) {
    hash ^= seed.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0) / 4294967296;
}

export function raidCheckBlockIndex(at: Date): number {
  return Math.floor(at.getTime() / BUSINESS_RAID_CHECK_INTERVAL_MS);
}

export function shouldRunRaidCheck(lastRaidCheckAt: Date, now: Date): boolean {
  return (
    raidCheckBlockIndex(now) > raidCheckBlockIndex(lastRaidCheckAt)
  );
}

function applyRaidLosses(
  safeCash: number,
  stored: Record<BusinessDrugKey, number>,
  band: BusinessHeatBand,
  roll: number,
  lossMultiplier = 1,
): BusinessRaidLosses {
  const fraction = BUSINESS_RAID_LOSS_FRACTION[band];
  const variance = 0.85 + roll * 0.3;
  const effective = Math.min(1, fraction * variance * lossMultiplier);

  const cashSeized = Math.floor(safeCash * effective);
  const drugsSeeded: BusinessRaidLosses = {
    cashSeized,
    drugsSeized: { hash: 0, shrooms: 0, coke: 0, heroin: 0 },
  };

  for (const key of ['hash', 'shrooms', 'coke', 'heroin'] as const) {
    drugsSeeded.drugsSeized[key] = Math.floor(stored[key] * effective);
  }

  return drugsSeeded;
}

export function resolveBusinessRaidCheck(input: BusinessRaidInput): BusinessRaidResult {
  const now = input.now ?? new Date();
  const blockIndex = raidCheckBlockIndex(now);
  const nextCheckAt = new Date((blockIndex + 1) * BUSINESS_RAID_CHECK_INTERVAL_MS);

  if (!shouldRunRaidCheck(input.lastRaidCheckAt, now)) {
    return {
      checked: false,
      raided: false,
      losses: emptyLosses(),
      nextLastRaidCheckAt: input.lastRaidCheckAt,
    };
  }

  const hasAssets =
    input.safeCash > 0 ||
    input.stored.hash + input.stored.shrooms + input.stored.coke + input.stored.heroin > 0;

  if (!hasAssets) {
    return {
      checked: true,
      raided: false,
      losses: emptyLosses(),
      nextLastRaidCheckAt: nextCheckAt,
    };
  }

  const chanceMultiplier = input.raidChanceMultiplier ?? 1;
  const chance = BUSINESS_RAID_CHANCE_PER_CHECK[input.heat.band] * chanceMultiplier;
  const roll = input.roll ?? raidCheckRoll(input.businessId, blockIndex);

  if (roll >= chance) {
    return {
      checked: true,
      raided: false,
      losses: emptyLosses(),
      nextLastRaidCheckAt: nextCheckAt,
    };
  }

  const lossRoll = raidCheckRoll(`${input.businessId}:loss`, blockIndex);
  const losses = applyRaidLosses(
    input.safeCash,
    input.stored,
    input.heat.band,
    lossRoll,
    input.raidLossMultiplier ?? 1,
  );

  return {
    checked: true,
    raided: true,
    losses,
    nextLastRaidCheckAt: nextCheckAt,
  };
}
