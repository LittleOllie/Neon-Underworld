import {
  ATTACK_RULES,
  ATTACK_TYPE_LABELS,
  ATTACK_TYPE_PURPOSE,
  type AttackType,
} from '@/config/game/attack-rules';

/** Player-facing turn count — "1 Turn" / "12 Turns". */
export function formatTurnCount(count: number): string {
  const n = Math.max(0, Math.floor(count));
  return n === 1 ? '1 Turn' : `${n.toLocaleString()} Turns`;
}

/** Attack selector label — e.g. "Strike · 5 Turns" (OptionGrid CSS uppercases). */
export function formatAttackTypeOptionLabel(attackType: AttackType): string {
  return `${ATTACK_TYPE_LABELS[attackType]} · ${formatTurnCount(ATTACK_RULES.turnCosts[attackType])}`;
}

/** Stat row / confirm copy for the selected attack's turn cost. */
export function formatAttackTurnCostDisplay(attackType: AttackType): string {
  return formatTurnCount(ATTACK_RULES.turnCosts[attackType]);
}

/** Insufficient-turn rejection — server and client share this wording. */
export function formatInsufficientTurnsForAttack(
  attackType: AttackType,
  availableTurns: number,
): string {
  const label = ATTACK_TYPE_LABELS[attackType];
  const required = formatTurnCount(ATTACK_RULES.turnCosts[attackType]);
  const available = Math.max(0, Math.floor(availableTurns));
  return `${label} requires ${required}. You currently have ${available.toLocaleString()}.`;
}

/** Dynamic description beneath the attack-type selector. */
export function attackTypeDescription(attackType: AttackType): string {
  return ATTACK_TYPE_PURPOSE[attackType];
}

export { ATTACK_TYPE_LABELS, ATTACK_TYPE_PURPOSE, ATTACK_RULES };
