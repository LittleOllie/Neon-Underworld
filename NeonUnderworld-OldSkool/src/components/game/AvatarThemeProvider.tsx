'use client';

import type { CSSProperties, ReactNode } from 'react';
import {
  avatarThemeCssVars,
  resolvePlayerAvatarConfig,
} from '@core/lib/game-engine/resolve-player-avatar';

export function AvatarThemeProvider({
  avatarId,
  children,
  className,
}: {
  avatarId: string | null | undefined;
  children: ReactNode;
  className?: string;
}) {
  const config = resolvePlayerAvatarConfig(avatarId);
  const themeStyle = avatarThemeCssVars(config) as CSSProperties;

  return (
    <div
      className={['g-avatar-theme', className ?? ''].filter(Boolean).join(' ')}
      data-avatar-theme={config.id}
      style={themeStyle}
    >
      {children}
    </div>
  );
}
