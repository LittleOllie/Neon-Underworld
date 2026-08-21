import {
  DEFAULT_PLAYER_AVATAR_ID,
  FOUNDING_PLAYER_AVATARS,
  isPlayerAvatarId,
  type PlayerAvatarId,
} from '@/config/game/player-avatars';

/** All founding avatars available for NPC assignment. */
export const NPC_ASSIGNABLE_AVATAR_IDS: readonly PlayerAvatarId[] = FOUNDING_PLAYER_AVATARS.map(
  (avatar) => avatar.id,
);

/** Email prefixes reserved for seeded / system-controlled opponents — never human accounts. */
export const NPC_MANAGED_EMAIL_PREFIXES = [
  'system+',
  'playtest-npc+',
  'dev-pvp+',
  'local-npc+',
] as const;

/**
 * Optional explicit faces for named dev PvP opponents.
 * Remaining NPCs use deterministic distribution from aliasNormalized.
 */
export const IMPORTANT_NPC_AVATARS: Partial<Record<string, PlayerAvatarId>> = {
  rustrunner: 'razor',
  dockrat: 'mercer',
  quarterghost: 'ghost',
  neonviper: 'viper',
  harborking: 'don',
  stripregent: 'midas',
  coinbroker: 'deacon',
  gridphantom42: 'spectre',
  velvetstrike: 'doll',
  nightauditor: 'saint',
};

function hashStableIdentifier(stableIdentifier: string): number {
  let hash = 2166136261;
  for (let i = 0; i < stableIdentifier.length; i++) {
    hash ^= stableIdentifier.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

/** True for system players and seeded opponent accounts (not normal human registrations). */
export function isNpcManagedAccount(input: {
  isSystemPlayer: boolean;
  email: string;
}): boolean {
  if (input.isSystemPlayer) return true;
  const email = input.email.trim().toLowerCase();
  return NPC_MANAGED_EMAIL_PREFIXES.some((prefix) => email.startsWith(prefix));
}

/**
 * Deterministic avatar for an NPC from a stable identifier (aliasNormalized or player id).
 * Same identifier always resolves to the same avatar.
 */
export function assignNpcAvatar(stableIdentifier: string): PlayerAvatarId {
  const key = stableIdentifier.trim().toLowerCase();
  if (!key) return DEFAULT_PLAYER_AVATAR_ID;

  const mapped = IMPORTANT_NPC_AVATARS[key];
  if (mapped) return mapped;

  const index = hashStableIdentifier(key) % NPC_ASSIGNABLE_AVATAR_IDS.length;
  return NPC_ASSIGNABLE_AVATAR_IDS[index] ?? DEFAULT_PLAYER_AVATAR_ID;
}

/** Whether an NPC record should receive/backfill an assigned avatar. */
export function npcAvatarNeedsBackfill(currentAvatar: string | null | undefined): boolean {
  if (currentAvatar == null || currentAvatar.trim() === '') return true;
  if (!isPlayerAvatarId(currentAvatar)) return true;
  // Migration/default viper on NPCs — replace with distributed identity.
  if (currentAvatar === DEFAULT_PLAYER_AVATAR_ID) return true;
  return false;
}

/** Resolved avatar id for display — invalid values fall back via standard resolver elsewhere. */
export function resolveNpcSeedAvatar(aliasNormalized: string): PlayerAvatarId {
  return assignNpcAvatar(aliasNormalized);
}
