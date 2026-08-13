'use client';

import Image from 'next/image';
import type { PlayerAvatarId } from '@core/config/game/player-avatars';
import {
  resolvePlayerAvatarConfig,
  resolvePlayerAvatarId,
} from '@core/lib/game-engine/resolve-player-avatar';

export type PlayerAvatarSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl';

const SIZE_PX: Record<PlayerAvatarSize, number> = {
  xs: 24,
  sm: 32,
  md: 40,
  lg: 56,
  xl: 96,
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
          width: px,
          height: px,
          minWidth: px,
          minHeight: px,
        } as React.CSSProperties
      }
      data-avatar-id={resolvedId}
    >
      <Image
        src={config.imagePath}
        alt={alt}
        width={px}
        height={px}
        sizes={`${px}px`}
        priority={priority}
        className="g-player-avatar__img"
      />
    </span>
  );
}

export type { PlayerAvatarId };
