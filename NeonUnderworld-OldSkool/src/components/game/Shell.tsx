'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Suspense } from 'react';
import { LogoutLink } from '@local/components/oldskool/LogoutLink';
import type { GameBackgroundKey } from '@local/config/backgrounds';
import { getBackgroundForPath } from '@local/config/route-backgrounds';
import { GlobalStatus, type GlobalStats } from './GlobalStatus';
import { GameNav } from './GameNav';
import { GameMainTransition } from './GameMainTransition';
import { GamePageBackground } from './GamePageBackground';
import { PlayerShellRefresh } from './PlayerShellRefresh';
import { PlayerShellProvider, usePlayerShell } from './PlayerShellProvider';
import { IdentityGate } from './IdentityGate';
import { PlayerAvatar } from './PlayerAvatar';
import {
  avatarThemeCssVars,
  resolvePlayerAvatarConfig,
} from '@core/lib/game-engine/resolve-player-avatar';
import { WireControl } from '@local/features/wire/WireControl';

export type { GlobalStats };

function GameShellFrame({
  background,
  avatarId,
  avatarPending,
  wireEnabled,
  children,
}: {
  background?: GameBackgroundKey;
  avatarId: string;
  avatarPending: boolean;
  wireEnabled?: boolean;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const { stats } = usePlayerShell();
  const resolvedBackground = background ?? getBackgroundForPath(pathname);
  const onIdentityRoute = pathname.startsWith('/identity');
  const themeConfig = resolvePlayerAvatarConfig(avatarId);
  const shellThemeStyle = avatarThemeCssVars(themeConfig) as React.CSSProperties;

  return (
    <IdentityGate avatarPending={avatarPending}>
      <div
        className={`g-shell${resolvedBackground ? ' g-shell--bg' : ''}`}
        style={shellThemeStyle}
        data-avatar-theme={themeConfig.id}
      >
          {resolvedBackground && (
            <GamePageBackground key={resolvedBackground} background={resolvedBackground} />
          )}
          <div className="g-top">
            <div className="g-brand-row">
              <Link href="/command" className="g-brand">
                NEON UNDERWORLD
              </Link>
              <LogoutLink />
            </div>
            <div className="g-header-meta">
              {stats.alias &&
                (onIdentityRoute ? (
                  <div className="g-player-line g-player-line--identity">
                    <span>
                      {stats.alias}
                      {stats.district ? ` · ${stats.district}` : ''}
                    </span>
                  </div>
                ) : (
                  <div className="g-header-profile">
                    <div className="g-header-profile__avatar">
                      <PlayerAvatar avatarId={avatarId} alt={stats.alias} size="header" />
                    </div>
                    <div className="g-header-profile__body">
                      <div className="g-player-line g-player-line--identity">
                        <span>
                          {stats.alias}
                          {stats.district ? ` · ${stats.district}` : ''}
                        </span>
                      </div>
                      <GlobalStatus stats={stats} />
                    </div>
                  </div>
                ))}
            </div>
            {!onIdentityRoute && <GameNav stats={stats} />}
          </div>
          <main className="g-main">
            <Suspense fallback={children}>
              <GameMainTransition>{children}</GameMainTransition>
            </Suspense>
          </main>
          {!onIdentityRoute && <PlayerShellRefresh />}
          {!onIdentityRoute && wireEnabled && <WireControl />}
          <footer className="g-footer">Neon Underworld · OldSkool Edition</footer>
      </div>
    </IdentityGate>
  );
}

export function GameShell({
  stats,
  background,
  avatarId = 'viper',
  avatarPending = false,
  wireEnabled = false,
  children,
}: {
  stats?: GlobalStats;
  /** Explicit override; otherwise derived from current pathname. */
  background?: GameBackgroundKey;
  avatarId?: string;
  avatarPending?: boolean;
  wireEnabled?: boolean;
  children: React.ReactNode;
}) {
  if (!stats) {
    return (
      <div className="g-shell">
        <main className="g-main">{children}</main>
      </div>
    );
  }

  return (
    <PlayerShellProvider initialStats={stats}>
      <GameShellFrame
        background={background}
        avatarId={avatarId}
        avatarPending={avatarPending}
        wireEnabled={wireEnabled}
      >
        {children}
      </GameShellFrame>
    </PlayerShellProvider>
  );
}
