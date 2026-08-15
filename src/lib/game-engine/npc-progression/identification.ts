import {
  NPC_PROGRESSION_EMAIL_PREFIXES,
} from '@/config/game/npc-progression-rules';

/** Attackable seeded opponents eligible for ladder progression. */
export function isProgressionNpcEmail(email: string): boolean {
  const normalized = email.trim().toLowerCase();
  return NPC_PROGRESSION_EMAIL_PREFIXES.some((prefix) => normalized.startsWith(prefix));
}

/**
 * True when a player record may receive automated NPC progression.
 * Requires progression email prefix AND not system filler (isSystemPlayer).
 */
export function isProgressionNpcAccount(input: {
  isSystemPlayer: boolean;
  email: string;
}): boolean {
  if (input.isSystemPlayer) return false;
  return isProgressionNpcEmail(input.email);
}
