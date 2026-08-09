import { PRODUCTION_CONFIG } from '@/config/game/balance';
import { grossWorkerCash, playerCashFromGross } from '@/lib/game-engine/worker-economics';

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
}): ProductionEstimate {
  const { turns, thugs, workers, payoutPercent } = input;
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

  const base = turns * thugs * PRODUCTION_CONFIG.baseDrugUnitsPerTurnPerThug;
  const drugMin = Math.floor(base * 0.85);
  const drugMax = Math.min(
    PRODUCTION_CONFIG.maxDrugUnitsPerAction,
    Math.floor(base * 1.15),
  );

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
