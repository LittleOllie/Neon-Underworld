import {
  DEFAULT_PLAYER_AVATAR_ID,
  getPlayerAvatarConfig,
  isPlayerAvatarId,
  type PlayerAvatarConfig,
  type PlayerAvatarId,
} from '@/config/game/player-avatars';
import {
  playerIdentityCssVars,
  type PlayerIdentityRecord,
} from '@/lib/game-engine/player-identity';
import { characterThemeFromAvatarId } from '@/lib/game-engine/player-identity';
import { themePaletteToCssVars } from '@/lib/game-engine/theme-safety';

/** Resolved avatar for display/theme — unknown or missing values fall back to Viper. */
export function resolvePlayerAvatarId(raw: string | null | undefined): PlayerAvatarId {
  if (raw && isPlayerAvatarId(raw)) return raw;
  return DEFAULT_PLAYER_AVATAR_ID;
}

export function resolvePlayerAvatarConfig(raw: string | null | undefined): PlayerAvatarConfig {
  return getPlayerAvatarConfig(resolvePlayerAvatarId(raw));
}

/** @deprecated Prefer needsIdentitySetup from player-identity (checks avatarSource). */
export function needsAvatarSelection(raw: string | null | undefined): boolean {
  return raw == null || raw.trim() === '';
}

export function avatarThemeCssVars(config: PlayerAvatarConfig): Record<string, string> {
  return themePaletteToCssVars(characterThemeFromAvatarId(config.id));
}

export function identityThemeCssVars(record: PlayerIdentityRecord): Record<string, string> {
  return playerIdentityCssVars(record);
}
