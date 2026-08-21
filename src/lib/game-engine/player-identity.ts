import type { PlayerAvatarSource } from '@prisma/client';
import { NU_DEFAULT_THEME, type ThemePalette } from '@/config/game/nu-default-theme';
import {
  buildThemePalette,
  normalizeHexColor,
  themePaletteToCssVars,
} from '@/lib/game-engine/theme-safety';
import {
  getPlayerAvatarConfig,
  isPlayerAvatarId,
  DEFAULT_PLAYER_AVATAR_ID,
  type PlayerAvatarId,
} from '@/config/game/player-avatars';
import { resolvePlayerAvatarConfig, resolvePlayerAvatarId } from '@/lib/game-engine/resolve-player-avatar';

export type { PlayerAvatarSource };

export interface PlayerIdentityRecord {
  avatar: string | null;
  avatarSource: PlayerAvatarSource | null;
  pfpUrl: string | null;
  themePrimary: string | null;
  themeSecondary: string | null;
}

export interface ResolvedPlayerIdentity {
  avatarSource: PlayerAvatarSource | null;
  avatarId: PlayerAvatarId | null;
  pfpUrl: string | null;
  imageSrc: string;
  theme: ThemePalette;
  hasCustomTheme: boolean;
}

/** New or returning players without a configured identity must complete setup. */
export function needsIdentitySetup(record: Pick<PlayerIdentityRecord, 'avatarSource'>): boolean {
  return record.avatarSource == null;
}

export function resolvePlayerIdentity(record: PlayerIdentityRecord): ResolvedPlayerIdentity {
  const avatarSource = record.avatarSource ?? null;
  const pfpUrl = record.pfpUrl ?? null;
  const customPrimary = record.themePrimary ? normalizeHexColor(record.themePrimary) : null;
  const customSecondary = record.themeSecondary ? normalizeHexColor(record.themeSecondary) : null;
  const hasCustomTheme = Boolean(customPrimary && customSecondary);

  let avatarId: PlayerAvatarId | null = null;
  let imageSrc: string;

  if (avatarSource === 'UPLOAD' && pfpUrl) {
    avatarId = null;
    imageSrc = pfpUrl;
  } else {
    avatarId = record.avatar && isPlayerAvatarId(record.avatar)
      ? record.avatar
      : resolvePlayerAvatarId(record.avatar);
    imageSrc = getPlayerAvatarConfig(avatarId as PlayerAvatarId).imagePath;
  }

  let theme: ThemePalette;
  if (hasCustomTheme) {
    theme = buildThemePalette(customPrimary!, customSecondary!);
  } else if (avatarSource === 'CHARACTER' && avatarId) {
    const config = getPlayerAvatarConfig(avatarId);
    theme = {
      primary: config.primary,
      secondary: config.secondary,
      glow: config.glow,
      muted: config.muted,
      mutedStrong: config.mutedStrong,
    };
  } else {
    theme = { ...NU_DEFAULT_THEME };
  }

  return {
    avatarSource,
    avatarId,
    pfpUrl,
    imageSrc,
    theme,
    hasCustomTheme,
  };
}

export function playerIdentityCssVars(record: PlayerIdentityRecord): Record<string, string> {
  return themePaletteToCssVars(resolvePlayerIdentity(record).theme);
}

export function characterThemeFromAvatarId(avatarId: PlayerAvatarId): ThemePalette {
  const config = resolvePlayerAvatarConfig(avatarId);
  return {
    primary: config.primary,
    secondary: config.secondary,
    glow: config.glow,
    muted: config.muted,
    mutedStrong: config.mutedStrong,
  };
}

export { DEFAULT_PLAYER_AVATAR_ID, resolvePlayerAvatarId, resolvePlayerAvatarConfig };
