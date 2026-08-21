import type { PlayerAvatarSource } from '@prisma/client';

/** Portable player identity fields for avatars + theme (shared across app layers). */
export interface PlayerIdentityView {
  avatar?: string | null;
  avatarSource?: PlayerAvatarSource | null;
  pfpUrl?: string | null;
  themePrimary?: string | null;
  themeSecondary?: string | null;
}

export function identityViewFromPlayer(player: {
  avatar: string | null;
  avatarSource: PlayerAvatarSource | null;
  pfpUrl: string | null;
  themePrimary: string | null;
  themeSecondary: string | null;
}): PlayerIdentityView {
  return {
    avatar: player.avatar,
    avatarSource: player.avatarSource,
    pfpUrl: player.pfpUrl,
    themePrimary: player.themePrimary,
    themeSecondary: player.themeSecondary,
  };
}
