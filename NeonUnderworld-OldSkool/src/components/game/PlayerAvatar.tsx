'use client';

import Image from 'next/image';
import type { PlayerAvatarSource } from '@prisma/client';
import type { PlayerAvatarId } from '@core/config/game/player-avatars';
import {
  resolvePlayerIdentity,
  type PlayerIdentityRecord,
} from '@core/lib/game-engine/player-identity';
import type { PlayerIdentityView as CorePlayerIdentityView } from '@core/lib/game-engine/player-identity-fields';

export type PlayerIdentityView = CorePlayerIdentityView;

export type PlayerAvatarSize = 'xs' | 'sm' | 'md' | 'lg' | 'rank' | 'xl' | 'identity' | 'header';

const SIZE_PX: Record<PlayerAvatarSize, number | null> = {
  xs: 24,
  sm: 32,
  md: 40,
  lg: 56,
  rank: 48,
  xl: 96,
  identity: 80,
  header: null,
};

export interface PlayerAvatarProps {
  /** @deprecated Pass `identity` for full PFP + theme support. */
  avatarId?: string | null;
  identity?: PlayerIdentityView | null;
  alt: string;
  size?: PlayerAvatarSize;
  shape?: 'circle' | 'square';
  className?: string;
  priority?: boolean;
}

function toIdentityRecord(
  avatarId: string | null | undefined,
  identity: PlayerIdentityView | null | undefined,
): PlayerIdentityRecord {
  if (identity) {
    return {
      avatar: identity.avatar ?? avatarId ?? null,
      avatarSource: identity.avatarSource ?? null,
      pfpUrl: identity.pfpUrl ?? null,
      themePrimary: identity.themePrimary ?? null,
      themeSecondary: identity.themeSecondary ?? null,
    };
  }
  return {
    avatar: avatarId ?? null,
    avatarSource: avatarId ? 'CHARACTER' : null,
    pfpUrl: null,
    themePrimary: null,
    themeSecondary: null,
  };
}

export function PlayerAvatar({
  avatarId,
  identity,
  alt,
  size = 'sm',
  shape = 'circle',
  className,
  priority = false,
}: PlayerAvatarProps) {
  const record = toIdentityRecord(avatarId, identity);
  const resolved = resolvePlayerIdentity(record);
  const px = SIZE_PX[size];
  const renderPx = px ?? 72;
  const isUpload = resolved.avatarSource === 'UPLOAD';

  return (
    <span
      className={[
        'g-player-avatar',
        `g-player-avatar--${size}`,
        shape === 'circle' ? 'g-player-avatar--circle' : 'g-player-avatar--square',
        isUpload ? 'g-player-avatar--upload' : '',
        className ?? '',
      ]
        .filter(Boolean)
        .join(' ')}
      style={
        {
          '--avatar-accent': resolved.theme.primary,
          '--avatar-accent-secondary': resolved.theme.secondary,
          '--avatar-accent-glow': resolved.theme.glow,
          ...(px != null
            ? {
                width: px,
                height: px,
                minWidth: px,
                minHeight: px,
              }
            : {}),
        } as React.CSSProperties
      }
      data-avatar-id={resolved.avatarId ?? undefined}
      data-avatar-source={resolved.avatarSource ?? undefined}
    >
      <Image
        src={resolved.imageSrc}
        alt={alt}
        width={renderPx}
        height={renderPx}
        sizes={px != null ? `${px}px` : '72px'}
        priority={priority}
        className="g-player-avatar__img"
        unoptimized={isUpload && resolved.imageSrc.startsWith('http')}
      />
    </span>
  );
}

export type { PlayerAvatarId };
