'use client';

import Image from 'next/image';
import type { PlayerAvatarId } from '@core/config/game/player-avatars';
import {
  resolvePlayerAvatarConfig,
  resolvePlayerAvatarId,
} from '@core/lib/game-engine/resolve-player-avatar';

export type PlayerAvatarSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl' | 'header';

const SIZE_PX: Record<PlayerAvatarSize, number | null> = {
  xs: 24,
  sm: 32,
  md: 40,
  lg: 56,
  xl: 96,
  header: null,
};

export interface PlayerAvatarProps {
  avatarId?: string | null;
  alt: string;
  size?: PlayerAvatarSize;
  shape?: 'circle' | 'square';
  className?: string;
  priority?: boolean;
}

export function PlayerAvatar({
  avatarId,
  alt,
  size = 'sm',
  shape = 'circle',
  className,
  priority = false,
}: PlayerAvatarProps) {
  const resolvedId = resolvePlayerAvatarId(avatarId);
  const config = resolvePlayerAvatarConfig(avatarId);
  const px = SIZE_PX[size];
  const renderPx = px ?? 72;

  return (
    <span
      className={[
        'g-player-avatar',
        `g-player-avatar--${size}`,
        shape === 'circle' ? 'g-player-avatar--circle' : 'g-player-avatar--square',
        className ?? '',
      ]
        .filter(Boolean)
        .join(' ')}
      style={
        {
          '--avatar-accent': config.primary,
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
      data-avatar-id={resolvedId}
    >
      <Image
        src={config.imagePath}
        alt={alt}
        width={renderPx}
        height={renderPx}
        sizes={px != null ? `${px}px` : '72px'}
        priority={priority}
        className="g-player-avatar__img"
      />
    </span>
  );
}

export type { PlayerAvatarId };
