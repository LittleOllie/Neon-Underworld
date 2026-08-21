import { HAPPINESS_CONFIG } from './balance';

/** One supply unit covers this many crew-turns (crew × turns spent). */
export const SUPPLY_CREW_TURNS_PER_UNIT = 150;

export const SUPPLY_CONSUMPTION = {
  /** Specialist supplies consumed on Scout / Operations (crew-turns from prostitutes). */
  worker: {
    condoms: true,
  },
  /** Thug supplies consumed on Scout / Produce (crew-turns from thugs). */
  thug: {
    beer: true,
  },
} as const;

/** Coverage below this triggers empire low-supply warnings. */
export const SUPPLY_WARNING_COVERAGE = 0.35;

export function supplyUnitsForCrewTurns(crewTurns: number): number {
  if (crewTurns <= 0) return 0;
  return Math.ceil(crewTurns / SUPPLY_CREW_TURNS_PER_UNIT);
}

export function workerCrewTurns(prostitutes: number, turnsSpent: number): number {
  return Math.max(0, prostitutes) * Math.max(0, turnsSpent);
}

export function thugCrewTurns(thugs: number, turnsSpent: number): number {
  return Math.max(0, thugs) * Math.max(0, turnsSpent);
}

export type SupplyField = 'condoms' | 'hash' | 'beer';

export interface SupplyConsumptionPlan {
  required: Partial<Record<SupplyField, number>>;
  consumed: Partial<Record<SupplyField, number>>;
  coverage: Partial<Record<SupplyField, number>>;
}

export interface SupplyInventory {
  condoms: number;
  hash: number;
  beer: number;
}

export interface SupplyConsumptionOptions {
  /** Hash production: workers do not consume hash as upkeep for this action */
  exemptWorkerHash?: boolean;
}

export function planSupplyConsumption(
  prostitutes: number,
  thugs: number,
  turnsSpent: number,
  inventory: SupplyInventory,
  options?: SupplyConsumptionOptions,
): SupplyConsumptionPlan {
  const workerTurns = workerCrewTurns(prostitutes, turnsSpent);
  const thugTurns = thugCrewTurns(thugs, turnsSpent);

  const required: Partial<Record<SupplyField, number>> = {};
  const consumed: Partial<Record<SupplyField, number>> = {};
  const coverage: Partial<Record<SupplyField, number>> = {};

  if (workerTurns > 0) {
    required.condoms = supplyUnitsForCrewTurns(workerTurns);
  }

  if (thugTurns > 0) {
    required.beer = supplyUnitsForCrewTurns(thugTurns);
  }

  for (const field of ['condoms', 'hash', 'beer'] as SupplyField[]) {
    const need = required[field] ?? 0;
    if (need <= 0) continue;
    const have = inventory[field];
    const used = Math.min(have, need);
    consumed[field] = used;
    coverage[field] = need > 0 ? used / need : 1;
  }

  return { required, consumed, coverage };
}

export function applySupplyConsumption(
  inventory: SupplyInventory,
  consumed: Partial<Record<SupplyField, number>>,
): SupplyInventory {
  return {
    condoms: Math.max(0, inventory.condoms - (consumed.condoms ?? 0)),
    hash: Math.max(0, inventory.hash - (consumed.hash ?? 0)),
    beer: Math.max(0, inventory.beer - (consumed.beer ?? 0)),
  };
}

/** Estimated days of coverage for a crew size at a reference turn spend. */
export function estimateSupplyCoverageDays(
  stock: number,
  crew: number,
  dailyTurnSpend: number,
): number {
  if (stock <= 0 || crew <= 0 || dailyTurnSpend <= 0) return 0;
  const dailyUnits = supplyUnitsForCrewTurns(crew * dailyTurnSpend);
  if (dailyUnits <= 0) return 999;
  return stock / dailyUnits;
}

export const SUPPLY_HAPPINESS_REFERENCE = HAPPINESS_CONFIG;
