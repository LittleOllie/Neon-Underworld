import { getDrugProductionRate } from '@/config/game/drug-production-rates';
import { PRODUCTION_CONFIG, type PlayerResources } from '@/config/game/balance';
import {
  planSupplyConsumption,
  type SupplyInventory,
} from '@/config/game/supply-economy';
import { happinessEfficiencyModifier } from '@/lib/game-engine/happiness';
import type { ProductionDrug } from '@/lib/game-engine/production';
import { grossWorkerCash, playerCashFromGross } from '@/lib/game-engine/worker-economics';

const PRODUCTION_VARIANCE_MIN = 0.85;
const PRODUCTION_VARIANCE_MAX = 1.15;

/** Expected drug units at average RNG (variance midpoint 1.0). */
export function estimateDrugUnitsProduced(input: {
  turnsSpent: number;
  thugCount: number;
  drugType: ProductionDrug;
  thugHappiness?: number;
  drugProductionBonus?: number;
}): number {
  const efficiency = happinessEfficiencyModifier(input.thugHappiness ?? 80);
  const bonus = 1 + Math.max(0, input.drugProductionBonus ?? 0);
  const raw =
    input.turnsSpent *
    input.thugCount *
    getDrugProductionRate(input.drugType) *
    efficiency *
    bonus;
  return Math.max(0, Math.floor(raw));
}

/** Sum of per-action floor estimates — matches multi-action production totals. */
export function estimateSplitDrugUnitsProduced(input: {
  turnChunks: number[];
  thugCount: number;
  drugType: ProductionDrug;
  thugHappiness?: number;
  drugProductionBonus?: number;
}): number {
  return input.turnChunks.reduce(
    (sum, turnsSpent) =>
      sum +
      estimateDrugUnitsProduced({
        turnsSpent,
        thugCount: input.thugCount,
        drugType: input.drugType,
        thugHappiness: input.thugHappiness,
        drugProductionBonus: input.drugProductionBonus,
      }),
    0,
  );
}

export interface ProducePreview {
  drugMin: number;
  drugMax: number;
  playerCash: number;
  /** Hash inventory delta range when producing hash (no worker hash upkeep). */
  hashNetMin?: number;
  hashNetMax?: number;
}

/** Produce preview aligned with resolveProduction rules (variance, lab bonus, supply exemption). */
export function estimateProducePreview(input: {
  turnsSpent: number;
  thugCount: number;
  prostituteCount: number;
  drugType: ProductionDrug;
  thugHappiness?: number;
  workerHappiness?: number;
  payoutPercent?: number;
  drugProductionBonus?: number;
}): ProducePreview {
  if (input.turnsSpent <= 0 || input.thugCount <= 0) {
    return { drugMin: 0, drugMax: 0, playerCash: 0 };
  }

  const thugEfficiency = happinessEfficiencyModifier(input.thugHappiness ?? 80);
  const workerEfficiency = happinessEfficiencyModifier(input.workerHappiness ?? 80);
  const rate = getDrugProductionRate(input.drugType);
  const bonusMultiplier = 1 + Math.max(0, input.drugProductionBonus ?? 0);
  const base = input.turnsSpent * input.thugCount * rate * thugEfficiency;

  const drugMin = Math.max(0, Math.floor(base * PRODUCTION_VARIANCE_MIN * bonusMultiplier));
  const drugMax = Math.max(0, Math.floor(base * PRODUCTION_VARIANCE_MAX * bonusMultiplier));

  const grossCash = grossWorkerCash(
    input.prostituteCount,
    input.turnsSpent,
    PRODUCTION_CONFIG.cashPerProstitutePerTurn,
  );
  const playerCash = Math.floor(
    playerCashFromGross(grossCash, input.payoutPercent ?? 50) * workerEfficiency,
  );

  if (input.drugType === 'hash') {
    return {
      drugMin,
      drugMax,
      playerCash,
      hashNetMin: drugMin,
      hashNetMax: drugMax,
    };
  }

  return { drugMin, drugMax, playerCash };
}

/** Expected hash net when producing hash (produced only — worker hash upkeep exempt). */
export function estimateHashProduceNet(input: {
  prostitutes: number;
  thugs: number;
  turnsSpent: number;
  thugHappiness?: number;
  drugProductionBonus?: number;
}): {
  hashProduced: number;
  hashConsumed: number;
  netHash: number;
} {
  const plan = planSupplyConsumption(
    input.prostitutes,
    input.thugs,
    input.turnsSpent,
    { condoms: Number.MAX_SAFE_INTEGER, hash: Number.MAX_SAFE_INTEGER, beer: Number.MAX_SAFE_INTEGER },
    { exemptWorkerHash: true },
  );
  const hashProduced = estimateDrugUnitsProduced({
    turnsSpent: input.turnsSpent,
    thugCount: input.thugs,
    drugType: 'hash',
    thugHappiness: input.thugHappiness,
    drugProductionBonus: input.drugProductionBonus,
  });
  const hashConsumed = plan.consumed.hash ?? 0;
  return {
    hashProduced,
    hashConsumed,
    netHash: hashProduced - hashConsumed,
  };
}

export function resolvePostProduceDrugCounts(input: {
  drugType: ProductionDrug;
  drugUnitsProduced: number;
  beforeDrugs: Pick<PlayerResources, 'hash' | 'shrooms' | 'coke' | 'heroin'>;
  suppliesAfter: SupplyInventory;
}): Pick<PlayerResources, 'hash' | 'shrooms' | 'coke' | 'heroin'> {
  const { drugType, drugUnitsProduced, beforeDrugs, suppliesAfter } = input;
  return {
    hash:
      drugType === 'hash'
        ? suppliesAfter.hash + drugUnitsProduced
        : suppliesAfter.hash,
    shrooms:
      drugType === 'shrooms'
        ? beforeDrugs.shrooms + drugUnitsProduced
        : beforeDrugs.shrooms,
    coke:
      drugType === 'coke'
        ? beforeDrugs.coke + drugUnitsProduced
        : beforeDrugs.coke,
    heroin:
      drugType === 'heroin'
        ? beforeDrugs.heroin + drugUnitsProduced
        : beforeDrugs.heroin,
  };
}
