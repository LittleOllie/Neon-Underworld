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
import { AvatarThemeProvider } from './AvatarThemeProvider';
import { IdentityGate } from './IdentityGate';
import { PlayerAvatar } from './PlayerAvatar';

export type { GlobalStats };

function GameShellFrame({
  background,
  avatarId,
  avatarPending,
  children,
}: {
  background?: GameBackgroundKey;
  avatarId: string;
  avatarPending: boolean;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const { stats } = usePlayerShell();
  const resolvedBackground = background ?? getBackgroundForPath(pathname);
  const onIdentityRoute = pathname.startsWith('/identity');

  return (
    <AvatarThemeProvider avatarId={avatarId}>
      <IdentityGate avatarPending={avatarPending}>
        <div className={`g-shell${resolvedBackground ? ' g-shell--bg' : ''}`}>
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
              {stats.alias && (
                <div className="g-player-line g-player-line--identity">
                  {!onIdentityRoute && (
                    <PlayerAvatar avatarId={avatarId} alt={stats.alias} size="xs" />
                  )}
                  <span>
                    {stats.alias}
                    {stats.district ? ` · ${stats.district}` : ''}
                  </span>
                </div>
              )}
              {!onIdentityRoute && <GlobalStatus stats={stats} />}
            </div>
            {!onIdentityRoute && <GameNav stats={stats} />}
          </div>
          <main className="g-main">
            <Suspense fallback={children}>
              <GameMainTransition>{children}</GameMainTransition>
            </Suspense>
          </main>
          {!onIdentityRoute && <PlayerShellRefresh />}
          <footer className="g-footer">Neon Underworld · OldSkool Edition</footer>
        </div>
      </IdentityGate>
    </AvatarThemeProvider>
  );
}

export function GameShell({
  stats,
  background,
  avatarId = 'viper',
  avatarPending = false,
  children,
}: {
  stats?: GlobalStats;
  /** Explicit override; otherwise derived from current pathname. */
  background?: GameBackgroundKey;
  avatarId?: string;
  avatarPending?: boolean;
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
      >
        {children}
      </GameShellFrame>
    </PlayerShellProvider>
  );
}
