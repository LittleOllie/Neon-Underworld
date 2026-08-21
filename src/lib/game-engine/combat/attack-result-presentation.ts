import {
  ATTACK_TYPE_LABELS,
  type AttackType,
} from '@/config/game/attack-rules';
import { TERMS, resourceLabel, type ResourceDisplayKey } from '@/config/game/terminology';
import type { DrugStock } from '@/lib/game-engine/combat/theft';

export type CombatOutcomeCode = 'SUCCESS' | 'PARTIAL' | 'REPULSED';

export type CombatReportRole = 'attacker' | 'defender';

export interface CombatResultPresentationInput {
  attackType: AttackType;
  outcome: CombatOutcomeCode | string;
  outcomeLabel?: string | null;
  targetAlias: string;
  attackerAlias?: string;
  cashStolen: number;
  workersStolen: number;
  drugsStolen: DrugStock;
  attackerLosses: number;
  defenderLosses: number;
  turnsSpent: number;
  role?: CombatReportRole;
  poachStrong?: boolean;
}

export interface CombatResultLine {
  text: string;
  tone?: 'positive' | 'negative' | 'neutral' | 'value';
}

export interface CombatResultSection {
  label: string;
  lines: CombatResultLine[];
}

export interface CombatResultPresentation {
  heading: string;
  headingVariant: 'success' | 'partial' | 'repulsed';
  contextLine: string;
  subtitle: string | null;
  sections: CombatResultSection[];
  closingLine: string;
}

const OUTCOME_HEADINGS: Record<CombatOutcomeCode, string> = {
  SUCCESS: 'VICTORY',
  PARTIAL: 'PARTIAL SUCCESS',
  REPULSED: 'REPULSED',
};

const TECH_LOOT_KEYS: ResourceDisplayKey[] = ['hash', 'shrooms', 'coke', 'heroin'];

function normalizeOutcome(outcome: string): CombatOutcomeCode {
  if (outcome === 'SUCCESS' || outcome === 'PARTIAL' || outcome === 'REPULSED') {
    return outcome;
  }
  return 'PARTIAL';
}

function isRawOutcomeEnum(label: string): boolean {
  return label === 'SUCCESS' || label === 'PARTIAL' || label === 'REPULSED';
}

function totalTechnology(drugs: DrugStock): number {
  return drugs.hash + drugs.shrooms + drugs.coke + drugs.heroin;
}

function roleLosses(input: CombatResultPresentationInput): {
  youLost: number;
  theyLost: number;
} {
  const role = input.role ?? 'attacker';
  if (role === 'defender') {
    return { youLost: input.defenderLosses, theyLost: input.attackerLosses };
  }
  return { youLost: input.attackerLosses, theyLost: input.defenderLosses };
}

export function formatCombatOutcomeHeading(outcome: CombatOutcomeCode | string): string {
  return OUTCOME_HEADINGS[normalizeOutcome(outcome)];
}

export function formatCombatContextLine(
  attackType: AttackType,
  targetAlias: string,
  options?: { role?: CombatReportRole; attackerAlias?: string },
): string {
  const label = ATTACK_TYPE_LABELS[attackType];
  const role = options?.role ?? 'attacker';
  if (role === 'defender' && options?.attackerAlias) {
    return `${label} from ${options.attackerAlias}`;
  }
  return `${label} on ${targetAlias}`;
}

export function formatCombatLootLines(input: CombatResultPresentationInput): CombatResultLine[] {
  if (input.attackType === 'DRIVE_BY') {
    return [];
  }

  const lines: CombatResultLine[] = [];

  if (input.cashStolen > 0) {
    lines.push({
      text: `$${input.cashStolen.toLocaleString()} ${TERMS.cash}`,
      tone: 'positive',
    });
  }

  if (input.workersStolen > 0) {
    lines.push({
      text: `${input.workersStolen.toLocaleString()} ${TERMS.specialists}`,
      tone: 'positive',
    });
  }

  for (const key of TECH_LOOT_KEYS) {
    const amount = input.drugsStolen[key];
    if (amount > 0) {
      lines.push({
        text: `${amount.toLocaleString()} ${resourceLabel(key)}`,
        tone: 'positive',
      });
    }
  }

  return lines;
}

export function formatCombatLossLines(input: CombatResultPresentationInput): CombatResultLine[] {
  const { youLost, theyLost } = roleLosses(input);
  return [
    {
      text: `${youLost.toLocaleString()} ${TERMS.enforcers}`,
      tone: youLost > 0 ? 'negative' : 'neutral',
    },
    {
      text: `${theyLost.toLocaleString()} ${TERMS.enforcers}`,
      tone: theyLost > 0 ? 'positive' : 'neutral',
    },
  ];
}

function formatLootSummary(input: CombatResultPresentationInput): string | null {
  const parts: string[] = [];

  if (input.cashStolen > 0) {
    parts.push(`$${input.cashStolen.toLocaleString()} ${TERMS.cash}`);
  }
  if (input.workersStolen > 0) {
    parts.push(
      `${input.workersStolen.toLocaleString()} ${input.workersStolen === 1 ? TERMS.specialist : TERMS.specialists}`,
    );
  }
  for (const key of TECH_LOOT_KEYS) {
    const amount = input.drugsStolen[key];
    if (amount > 0) {
      parts.push(`${amount.toLocaleString()} ${resourceLabel(key)}`);
    }
  }

  if (parts.length === 0) return null;
  if (parts.length === 1) return parts[0]!;
  if (parts.length === 2) return `${parts[0]} and ${parts[1]}`;
  return `${parts.slice(0, -1).join(', ')}, and ${parts[parts.length - 1]}`;
}

function hasSecuredLoot(input: CombatResultPresentationInput): boolean {
  return (
    input.cashStolen > 0 ||
    input.workersStolen > 0 ||
    totalTechnology(input.drugsStolen) > 0
  );
}

export function formatCombatClosingLine(input: CombatResultPresentationInput): string {
  const outcome = normalizeOutcome(input.outcome);
  const attackLabel = ATTACK_TYPE_LABELS[input.attackType];
  const role = input.role ?? 'attacker';
  const { youLost } = roleLosses(input);
  const lootSummary = formatLootSummary(input);

  if (role === 'defender') {
    if (outcome === 'REPULSED') {
      return youLost > 0
        ? `Defence held. You lost ${youLost.toLocaleString()} ${youLost === 1 ? TERMS.enforcer : TERMS.enforcers}; the attacker secured nothing.`
        : 'Defence held. The attack was repelled.';
    }
    if (outcome === 'PARTIAL') {
      return youLost > 0
        ? `${attackLabel} partial against you. You lost ${youLost.toLocaleString()} ${youLost === 1 ? TERMS.enforcer : TERMS.enforcers}; limited assets were taken.`
        : `${attackLabel} partial against you. Limited damage to your operation.`;
    }
    if (lootSummary) {
      return `${attackLabel} succeeded against you. You lost ${lootSummary}.`;
    }
    return `${attackLabel} succeeded against you.`;
  }

  if (input.attackType === 'DRIVE_BY') {
    if (outcome === 'SUCCESS') {
      return 'Strike complete. You inflicted crew losses.';
    }
    if (outcome === 'PARTIAL') {
      return 'Strike partial. You broke through but inflicted no crew losses.';
    }
    return youLost > 0
      ? `Strike repulsed. You lost ${youLost.toLocaleString()} ${youLost === 1 ? TERMS.enforcer : TERMS.enforcers}.`
      : 'Strike repulsed. Defenders held the line.';
  }

  if (outcome === 'SUCCESS') {
    if (lootSummary) {
      return `${attackLabel} complete. You secured ${lootSummary}.`;
    }
    return `${attackLabel} complete.`;
  }

  if (outcome === 'PARTIAL') {
    return `${attackLabel} partial. Their crew took damage but you secured nothing.`;
  }

  return youLost > 0
    ? `${attackLabel} repulsed. You lost ${youLost.toLocaleString()} ${youLost === 1 ? TERMS.enforcer : TERMS.enforcers} and secured nothing.`
    : `${attackLabel} repulsed. You secured nothing.`;
}

/** Canonical human-readable outcome copy — shared by combat resolution and idempotent replay. */
export function buildCombatOutcomeLabel(input: {
  attackType: AttackType;
  outcome: CombatOutcomeCode | string;
  workersStolen?: number;
  poachStrong?: boolean;
}): string {
  const outcome = normalizeOutcome(input.outcome);
  const workersStolen = Math.max(0, Math.floor(input.workersStolen ?? 0));

  if (input.attackType === 'DRIVE_BY') {
    if (outcome === 'SUCCESS') {
      return 'Drive-by complete — you won the clash and inflicted damage.';
    }
    if (outcome === 'PARTIAL') {
      return 'Drive-by broke through — defenders held with no losses.';
    }
    return 'Drive-by repelled — defenders held the line.';
  }

  if (input.attackType === 'POACH_WORKERS') {
    if (outcome === 'REPULSED') {
      return 'Poach attempt failed — their crew refused to move.';
    }
    if (outcome === 'SUCCESS' && workersStolen > 0) {
      return input.poachStrong
        ? `${TERMS.specialists} poached — ${workersStolen.toLocaleString()} joined your operation.`
        : `${TERMS.specialists} poached — ${workersStolen.toLocaleString()} transferred to your crew.`;
    }
    return 'Poach attempt repelled — defenders stopped the workforce transfer.';
  }

  const attackLabel = ATTACK_TYPE_LABELS[input.attackType];
  if (outcome === 'SUCCESS') {
    return `${attackLabel} successful.`;
  }
  if (outcome === 'PARTIAL') {
    return `${attackLabel} partial — defenders damaged, no assets taken.`;
  }
  return `${attackLabel} repulsed.`;
}

export function resolveCombatOutcomeLabel(input: {
  attackType: AttackType;
  outcome: CombatOutcomeCode | string;
  outcomeLabel?: string | null;
  workersStolen?: number;
  poachStrong?: boolean;
}): string {
  if (input.outcomeLabel && !isRawOutcomeEnum(input.outcomeLabel)) {
    return input.outcomeLabel;
  }
  return buildCombatOutcomeLabel(input);
}

export function buildCombatResultPresentation(
  input: CombatResultPresentationInput,
): CombatResultPresentation {
  const outcome = normalizeOutcome(input.outcome);
  const lootLines = formatCombatLootLines(input);
  const lossPair = roleLosses(input);
  const sections: CombatResultSection[] = [];

  if (input.attackType !== 'DRIVE_BY') {
    sections.push({
      label: 'YOU TOOK',
      lines:
        lootLines.length > 0
          ? lootLines
          : [{ text: 'NO RESOURCES SECURED', tone: 'neutral' }],
    });
  }

  sections.push({
    label: 'YOU LOST',
    lines: [
      {
        text: `${lossPair.youLost.toLocaleString()} ${TERMS.enforcers}`,
        tone: lossPair.youLost > 0 ? 'negative' : 'neutral',
      },
    ],
  });

  sections.push({
    label: 'THEY LOST',
    lines: [
      {
        text: `${lossPair.theyLost.toLocaleString()} ${TERMS.enforcers}`,
        tone: lossPair.theyLost > 0 ? 'positive' : 'neutral',
      },
    ],
  });

  sections.push({
    label: 'COST',
    lines: [
      {
        text: input.turnsSpent === 1 ? '1 Turn' : `${input.turnsSpent.toLocaleString()} Turns`,
        tone: 'neutral',
      },
    ],
  });

  const headingVariant =
    outcome === 'SUCCESS' ? 'success' : outcome === 'REPULSED' ? 'repulsed' : 'partial';

  return {
    heading: formatCombatOutcomeHeading(outcome),
    headingVariant,
    contextLine: formatCombatContextLine(input.attackType, input.targetAlias, {
      role: input.role,
      attackerAlias: input.attackerAlias,
    }),
    subtitle: resolveCombatOutcomeLabel(input),
    sections,
    closingLine: formatCombatClosingLine(input),
  };
}

export function combatSnapshotToPresentationInput(
  snapshot: {
    attackType: AttackType;
    outcome: string;
    outcomeLabel: string;
    targetAlias?: string;
    attackerAlias?: string;
    cashStolen: number;
    workersStolen: number;
    drugsStolen: DrugStock;
    attackerLosses: number;
    defenderLosses: number;
    turnsSpent: number;
  },
  role: CombatReportRole,
): CombatResultPresentationInput {
  return {
    attackType: snapshot.attackType,
    outcome: snapshot.outcome,
    outcomeLabel: snapshot.outcomeLabel,
    targetAlias: snapshot.targetAlias ?? 'Unknown',
    attackerAlias: snapshot.attackerAlias,
    cashStolen: snapshot.cashStolen,
    workersStolen: snapshot.workersStolen,
    drugsStolen: snapshot.drugsStolen,
    attackerLosses: snapshot.attackerLosses,
    defenderLosses: snapshot.defenderLosses,
    turnsSpent: snapshot.turnsSpent,
    role,
  };
}

/** @internal test helper */
export function _hasSecuredLoot(input: CombatResultPresentationInput): boolean {
  return hasSecuredLoot(input);
}
