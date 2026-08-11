import type { ActionResultLine } from '@local/components/game/ActionResult';

export function buildSupplyImpactLines(input: {
  suppliesUsed?: { condoms?: number; hash?: number; beer?: number };
  workerMoraleBefore?: number;
  workerMoraleAfter?: number;
  thugMoraleBefore?: number;
  thugMoraleAfter?: number;
}): ActionResultLine[] {
  const lines: ActionResultLine[] = [];
  const used = input.suppliesUsed;
  if (used?.beer || used?.condoms || used?.hash) {
    const parts: string[] = [];
    if (used.beer) parts.push(`Beer −${used.beer}`);
    if (used.condoms) parts.push(`Condoms −${used.condoms}`);
    if (used.hash) parts.push(`Hash −${used.hash}`);
    lines.push({ text: `Supplies used: ${parts.join(' · ')}` });
  }
  if (
    input.workerMoraleBefore != null &&
    input.workerMoraleAfter != null &&
    input.workerMoraleBefore !== input.workerMoraleAfter
  ) {
    lines.push({
      text: `Worker morale ${input.workerMoraleBefore}% → ${input.workerMoraleAfter}%`,
    });
  }
  if (
    input.thugMoraleBefore != null &&
    input.thugMoraleAfter != null &&
    input.thugMoraleBefore !== input.thugMoraleAfter
  ) {
    lines.push({
      text: `Thug morale ${input.thugMoraleBefore}% → ${input.thugMoraleAfter}%`,
    });
  }
  return lines;
}
