import {
  DEFAULT_PLAYER_AVATAR_ID,
  getPlayerAvatarConfig,
  isPlayerAvatarId,
  type PlayerAvatarConfig,
  type PlayerAvatarId,
} from '@/config/game/player-avatars';

/** Resolved avatar for display/theme — unknown or missing values fall back to Viper. */
export function resolvePlayerAvatarId(raw: string | null | undefined): PlayerAvatarId {
  if (raw && isPlayerAvatarId(raw)) return raw;
  return DEFAULT_PLAYER_AVATAR_ID;
}

export function resolvePlayerAvatarConfig(raw: string | null | undefined): PlayerAvatarConfig {
  return getPlayerAvatarConfig(resolvePlayerAvatarId(raw));
}

/** New players with no stored avatar must complete identity selection. */
export function needsAvatarSelection(raw: string | null | undefined): boolean {
  return raw == null || raw.trim() === '';
}

export function avatarThemeCssVars(config: PlayerAvatarConfig): Record<string, string> {
  return {
    '--nu-accent-primary': config.primary,
    '--nu-accent-secondary': config.secondary,
    '--nu-accent-glow': config.glow,
    '--nu-accent-muted': config.muted,
    '--nu-accent-muted-strong': config.mutedStrong,
    /* Legacy NU tokens — map gold/link aliases so all surfaces inherit avatar colour. */
    '--os-gold': config.primary,
    '--os-gold-dark': config.secondary,
    '--os-highlight': config.muted,
    '--os-highlight-strong': config.mutedStrong,
    '--os-link': config.primary,
    '--game-gold': config.primary,
    '--game-gold-dark': config.secondary,
  };
}
