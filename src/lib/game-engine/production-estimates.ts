import { getDrugProductionRate } from '@/config/game/drug-production-rates';
import { grossWorkerCash, playerCashFromGross } from '@/lib/game-engine/worker-economics';
import type { ProductionDrug } from '@/lib/game-engine/production';

export interface ProductionEstimate {
  drugMin: number;
  drugMax: number;
  workerCashMin: number;
  workerCashMax: number;
  playerCashMin: number;
  playerCashMax: number;
}

/** Approximate range — actual output uses seeded randomness */
export function estimateProduction(input: {
  turns: number;
  thugs: number;
  workers: number;
  payoutPercent: number;
  drugType?: ProductionDrug;
}): ProductionEstimate {
  const { turns, thugs, workers, payoutPercent } = input;
  const drugType = input.drugType ?? 'hash';
  if (turns <= 0 || thugs <= 0) {
    return {
      drugMin: 0,
      drugMax: 0,
      workerCashMin: 0,
      workerCashMax: 0,
      playerCashMin: 0,
      playerCashMax: 0,
    };
  }

  const rate = getDrugProductionRate(drugType);
  const base = turns * thugs * rate;
  const drugMin = Math.floor(base * 0.85);
  const drugMax = Math.floor(base * 1.15);

  const grossMin = grossWorkerCash(workers, turns);
  const grossMax = grossMin;
  const playerCashMin = playerCashFromGross(grossMin, payoutPercent);
  const playerCashMax = playerCashFromGross(grossMax, payoutPercent);

  return {
    drugMin,
    drugMax,
    workerCashMin: grossMin,
    workerCashMax: grossMax,
    playerCashMin,
    playerCashMax,
  };
}
