import type { ProductionDrug } from '@/lib/game-engine/production';

/**
 * Per-thug per-turn drug output before variance and happiness efficiency.
 * Hash highest (Worker supply); heroin lowest (premium street value).
 */
export const DRUG_PRODUCTION_RATES: Record<ProductionDrug, number> = {
  hash: 0.012,
  shrooms: 0.009,
  coke: 0.006,
  heroin: 0.004,
} as const;

export function getDrugProductionRate(drug: ProductionDrug): number {
  return DRUG_PRODUCTION_RATES[drug];
}

/** Expected units at average RNG (variance 1.0) and given thug efficiency. */
export function expectedDrugUnits(
  turns: number,
  thugs: number,
  drug: ProductionDrug,
  thugEfficiency = 1,
): number {
  if (turns <= 0 || thugs <= 0) return 0;
  return Math.floor(
    turns * thugs * getDrugProductionRate(drug) * thugEfficiency,
  );
}

/** Turns (at 100% efficiency) before floor output reaches `target` units. */
export function turnsToReachDrugUnits(
  thugs: number,
  drug: ProductionDrug,
  target: number,
  thugEfficiency = 1,
): number | null {
  if (thugs <= 0 || target <= 0) return null;
  const perTurn = thugs * getDrugProductionRate(drug) * thugEfficiency;
  if (perTurn <= 0) return null;
  return Math.ceil(target / perTurn);
}
