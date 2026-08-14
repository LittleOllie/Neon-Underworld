import {
  applySupplyConsumption,
  planSupplyConsumption,
  type SupplyConsumptionPlan,
  type SupplyField,
  type SupplyInventory,
} from '@/config/game/supply-economy';

export type { SupplyConsumptionPlan, SupplyInventory, SupplyField };

export interface SupplyActionResult {
  plan: SupplyConsumptionPlan;
  inventoryAfter: SupplyInventory;
}

export function resolveSupplyConsumptionForAction(input: {
  prostitutes: number;
  thugs: number;
  turnsSpent: number;
  condoms: number;
  hash: number;
  beer: number;
  /** Hash production: workers do not consume hash as upkeep */
  exemptWorkerHash?: boolean;
}): SupplyActionResult {
  const inventory: SupplyInventory = {
    condoms: input.condoms,
    hash: input.hash,
    beer: input.beer,
  };
  const plan = planSupplyConsumption(
    input.prostitutes,
    input.thugs,
    input.turnsSpent,
    inventory,
    { exemptWorkerHash: input.exemptWorkerHash },
  );
  const inventoryAfter = applySupplyConsumption(inventory, plan.consumed);
  return { plan, inventoryAfter };
}

export function formatSupplyUsedLines(
  consumed: Partial<Record<SupplyField, number>>,
): string[] {
  const lines: string[] = [];
  if (consumed.condoms) lines.push(`Condoms −${consumed.condoms}`);
  if (consumed.hash) lines.push(`Hash −${consumed.hash}`);
  if (consumed.beer) lines.push(`Beer −${consumed.beer}`);
  return lines;
}
