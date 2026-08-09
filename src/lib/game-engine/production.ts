import { PRODUCTION_CONFIG } from '@/config/game/balance';
import {
  calculateDepartureRisk,
} from '@/lib/game-engine/happiness';
import { createSeededRng } from '@/lib/game-engine/rng';
import { grossWorkerCash, playerCashFromGross } from '@/lib/game-engine/worker-economics';

export type ProductionDrug = 'hash' | 'shrooms' | 'coke' | 'heroin';

export interface ProductionInput {
  turnsSpent: number;
  thugCount: number;
  prostituteCount: number;
  prostituteHappiness: number;
  thugHappiness: number;
  prostitutePayoutPercent: number;
  drugType: ProductionDrug;
  seed: number;
}

export interface ProductionOutcome {
  drugType: ProductionDrug;
  drugUnitsProduced: number;
  cashEarned: number;
  prostitutesLost: number;
  thugsLost: number;
  summary: string;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export function resolveProduction(input: ProductionInput): ProductionOutcome {
  const rng = createSeededRng(input.seed);
  const variance = rng.nextFloat(0.85, 1.15);

  const rawUnits =
    input.turnsSpent *
    input.thugCount *
    PRODUCTION_CONFIG.baseDrugUnitsPerTurnPerThug *
    variance;

  const drugUnitsProduced = clamp(
    Math.floor(rawUnits),
    0,
    PRODUCTION_CONFIG.maxDrugUnitsPerAction,
  );

  const grossCash = grossWorkerCash(
    input.prostituteCount,
    input.turnsSpent,
    PRODUCTION_CONFIG.cashPerProstitutePerTurn,
  );
  const cashEarned = playerCashFromGross(grossCash, input.prostitutePayoutPercent);

  const { prostitutesLost, thugsLost } = calculateDepartureRisk(
    input.turnsSpent,
    input.prostituteHappiness,
    input.thugHappiness,
    input.prostituteCount,
    input.thugCount,
  );

  const summary = buildProductionSummary({
    drugType: input.drugType,
    drugUnitsProduced,
    cashEarned,
    prostitutesLost,
    thugsLost,
    thugCount: input.thugCount,
  });

  return {
    drugType: input.drugType,
    drugUnitsProduced,
    cashEarned,
    prostitutesLost,
    thugsLost,
    summary,
  };
}

function buildProductionSummary(params: {
  drugType: ProductionDrug;
  drugUnitsProduced: number;
  cashEarned: number;
  prostitutesLost: number;
  thugsLost: number;
  thugCount: number;
}): string {
  const parts: string[] = [];

  if (params.thugCount === 0) {
    parts.push('No thugs on payroll — nothing was produced.');
  } else if (params.drugUnitsProduced > 0) {
    parts.push(`Your crew cooked ${params.drugUnitsProduced} units of ${params.drugType}.`);
  } else {
    parts.push('Production ran thin — minimal output this run.');
  }

  if (params.cashEarned > 0) {
    parts.push(`Workers generated $${params.cashEarned.toLocaleString()} while you produced.`);
  }

  if (params.prostitutesLost > 0) {
    parts.push(`${params.prostitutesLost} workers walked out due to low morale.`);
  }
  if (params.thugsLost > 0) {
    parts.push(`${params.thugsLost} thugs left the organisation.`);
  }

  return parts.join(' ');
}

export function validateProductionAmount(
  amount: number,
  availableTurns: number,
): { valid: boolean; error?: string } {
  if (!Number.isInteger(amount)) {
    return { valid: false, error: 'Turn amount must be a whole number' };
  }
  if (amount < PRODUCTION_CONFIG.minTurnSpend) {
    return { valid: false, error: `Minimum production spend is ${PRODUCTION_CONFIG.minTurnSpend} turns` };
  }
  if (amount > PRODUCTION_CONFIG.maxTurnSpend) {
    return { valid: false, error: `Maximum production spend is ${PRODUCTION_CONFIG.maxTurnSpend} turns per action` };
  }
  if (amount > availableTurns) {
    return { valid: false, error: 'Insufficient turns' };
  }
  return { valid: true };
}
