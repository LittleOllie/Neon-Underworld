import {
  WORKER_POACHING_RULES,
  capPoachedWorkers,
  happinessPoachMultiplier,
  protectionPoachMultiplier,
  protectionRatio,
} from '@/config/game/worker-poaching-rules';
import type { CombatRng } from './combat-random';

export interface WorkerPoachInput {
  attackerVictory: boolean;
  tacticalSuccess: boolean;
  defenderWorkers: number;
  /** Defender thugs + cartel virtual support + cartel armoury thugs. */
  defenderThugsForProtection: number;
  workerHappiness: number;
  survivingAttackers: number;
  attackingThugs: number;
  rng: CombatRng;
}

export interface WorkerPoachResult {
  workersStolen: number;
  /** For outcome labelling — upper band of allowed transfer. */
  strongSuccess: boolean;
}

export function resolveWorkerPoach(input: WorkerPoachInput): WorkerPoachResult {
  const empty = { workersStolen: 0, strongSuccess: false };
  if (!input.attackerVictory || !input.tacticalSuccess) return empty;
  if (input.defenderWorkers < WORKER_POACHING_RULES.minWorkersToPoach) return empty;

  const survivalRatio =
    input.attackingThugs > 0 ? input.survivingAttackers / input.attackingThugs : 0;
  if (survivalRatio < WORKER_POACHING_RULES.minSurvivalRatio) return empty;

  const happinessMult = happinessPoachMultiplier(input.workerHappiness);
  const protRatio = protectionRatio(
    input.defenderThugsForProtection,
    input.defenderWorkers,
  );
  const protectionMult = protectionPoachMultiplier(protRatio);

  const variance =
    WORKER_POACHING_RULES.rngVarianceMin +
    input.rng.next() *
      (WORKER_POACHING_RULES.rngVarianceMax - WORKER_POACHING_RULES.rngVarianceMin);

  let pct =
    WORKER_POACHING_RULES.basePoachPercent *
    happinessMult *
    protectionMult *
    variance *
    survivalRatio;
  pct = Math.min(pct, WORKER_POACHING_RULES.maxPoachPercent);

  let stolen = Math.floor(input.defenderWorkers * pct);
  stolen = capPoachedWorkers(stolen, input.defenderWorkers);

  if (stolen <= 0 && pct > 0) {
    stolen = capPoachedWorkers(1, input.defenderWorkers);
  }

  stolen = Math.min(stolen, input.defenderWorkers);
  if (stolen <= 0) return empty;

  const maxAllowed = capPoachedWorkers(
    Math.floor(input.defenderWorkers * WORKER_POACHING_RULES.maxPoachPercent),
    input.defenderWorkers,
  );
  const strongSuccess =
    maxAllowed > 0 &&
    stolen >= Math.floor(maxAllowed * WORKER_POACHING_RULES.strongSuccessFractionOfCap);

  return { workersStolen: stolen, strongSuccess };
}
