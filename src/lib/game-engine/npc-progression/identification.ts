import {
  NPC_LOCAL_FIXTURE_PREFIX,
  NPC_PROGRESSION_EMAIL_PREFIXES,
} from '@/config/game/npc-progression-rules';

/** Whether static local-npc fixtures participate in automated progression. */
export function isLocalNpcProgressionEnabled(): boolean {
  return process.env.NPC_PROGRESSION_INCLUDE_LOCAL === 'true';
}

/** Email prefixes eligible for ladder progression this run. */
export function getProgressionEmailPrefixes(): readonly string[] {
  if (isLocalNpcProgressionEnabled()) {
    return [...NPC_PROGRESSION_EMAIL_PREFIXES, NPC_LOCAL_FIXTURE_PREFIX];
  }
  return NPC_PROGRESSION_EMAIL_PREFIXES;
}

/** Attackable seeded opponents eligible for ladder progression. */
export function isProgressionNpcEmail(email: string): boolean {
  const normalized = email.trim().toLowerCase();
  return getProgressionEmailPrefixes().some((prefix) => normalized.startsWith(prefix));
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

/** Prisma `OR` filters for progression NPC candidate queries. */
export function progressionNpcEmailOrFilters(): Array<{ email: { startsWith: string } }> {
  return getProgressionEmailPrefixes().map((prefix) => ({ email: { startsWith: prefix } }));
}
