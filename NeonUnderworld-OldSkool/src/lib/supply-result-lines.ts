import type { ActionResultLine } from '@local/components/game/ActionResult';
import { resourceLabel, OS_TERMS } from '@local/config/terminology';

function resourceDisplayName(drugType: string): string {
  if (drugType === 'hash' || drugType === 'shrooms' || drugType === 'coke' || drugType === 'heroin') {
    return resourceLabel(drugType);
  }
  return drugType;
}

export function buildSupplyImpactLines(input: {
  drugType?: string;
  drugUnitsProduced?: number;
  suppliesUsed?: { condoms?: number; hash?: number; beer?: number };
  hashNetChange?: number;
  workerMoraleBefore?: number;
  workerMoraleAfter?: number;
  thugMoraleBefore?: number;
  thugMoraleAfter?: number;
}): ActionResultLine[] {
  const lines: ActionResultLine[] = [];
  const used = input.suppliesUsed;

  if (input.drugUnitsProduced != null && input.drugUnitsProduced > 0 && input.drugType) {
    lines.push({
      text: `Output: +${input.drugUnitsProduced.toLocaleString()} ${resourceDisplayName(input.drugType)}`,
      tone: 'positive',
    });
  }

  if (used?.beer || used?.condoms || used?.hash) {
    const parts: string[] = [];
    if (used.hash) parts.push(`${OS_TERMS.hash} −${used.hash.toLocaleString()}`);
    if (used.condoms) parts.push(`${OS_TERMS.kits} −${used.condoms.toLocaleString()}`);
    if (used.beer) parts.push(`${OS_TERMS.rations} −${used.beer.toLocaleString()}`);
    lines.push({ text: `Supplies used: ${parts.join(' · ')}` });
  }

  if (input.drugType === 'hash' && input.hashNetChange != null) {
    const sign = input.hashNetChange >= 0 ? '+' : '';
    lines.push({
      text: `Net ${OS_TERMS.hash}: ${sign}${input.hashNetChange.toLocaleString()}`,
      tone: input.hashNetChange >= 0 ? 'positive' : 'negative',
    });
  }

  if (
    input.workerMoraleBefore != null &&
    input.workerMoraleAfter != null &&
    input.workerMoraleBefore !== input.workerMoraleAfter
  ) {
    lines.push({
      text: `${OS_TERMS.specialist} morale ${input.workerMoraleBefore}% → ${input.workerMoraleAfter}%`,
    });
  }
  if (
    input.thugMoraleBefore != null &&
    input.thugMoraleAfter != null &&
    input.thugMoraleBefore !== input.thugMoraleAfter
  ) {
    lines.push({
      text: `${OS_TERMS.enforcer} morale ${input.thugMoraleBefore}% → ${input.thugMoraleAfter}%`,
    });
  }
  return lines;
}
