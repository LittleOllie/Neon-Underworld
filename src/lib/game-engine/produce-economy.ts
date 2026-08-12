import { PRODUCTION_CONFIG } from '@/config/game/balance';
import type { PlayerResources } from '@/config/game/balance';
import {
  planSupplyConsumption,
  type SupplyInventory,
} from '@/config/game/supply-economy';
import { happinessEfficiencyModifier } from '@/lib/game-engine/happiness';
import type { ProductionDrug } from '@/lib/game-engine/production';

/** Expected drug units at average RNG (variance midpoint 1.0). */
export function estimateDrugUnitsProduced(input: {
  turnsSpent: number;
  thugCount: number;
  thugHappiness?: number;
}): number {
  const efficiency = happinessEfficiencyModifier(input.thugHappiness ?? 80);
  const raw =
    input.turnsSpent *
    input.thugCount *
    PRODUCTION_CONFIG.baseDrugUnitsPerTurnPerThug *
    efficiency;
  return Math.min(
    Math.floor(raw),
    PRODUCTION_CONFIG.maxDrugUnitsPerAction,
  );
}

/** Expected hash net when producing hash (produced − worker hash supply). */
export function estimateHashProduceNet(input: {
  prostitutes: number;
  thugs: number;
  turnsSpent: number;
  thugHappiness?: number;
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
  );
  const hashProduced = estimateDrugUnitsProduced({
    turnsSpent: input.turnsSpent,
    thugCount: input.thugs,
    thugHappiness: input.thugHappiness,
  });
  const hashConsumed = plan.required.hash ?? 0;
  return {
    hashProduced,
    hashConsumed,
    netHash: hashProduced - hashConsumed,
  };
}

/** Approximate break-even thug:worker ratio for hash self-supply (continuous, no rounding). */
export function hashProduceBreakEvenThugRatio(): number {
  const perThugPerTurn = PRODUCTION_CONFIG.baseDrugUnitsPerTurnPerThug;
  const perWorkerPerTurn = 1 / 150;
  return perWorkerPerTurn / perThugPerTurn;
}

export function isHashProduceLikelyNetNegative(input: {
  prostitutes: number;
  thugs: number;
  turnsSpent: number;
  thugHappiness?: number;
}): boolean {
  if (input.thugs < 1 || input.turnsSpent < 1) return false;
  return estimateHashProduceNet(input).netHash < 0;
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
