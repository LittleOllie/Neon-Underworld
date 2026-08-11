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

export type { GlobalStats };

export function GameShell({
  stats,
  background,
  children,
}: {
  stats?: GlobalStats;
  /** Explicit override; otherwise derived from current pathname. */
  background?: GameBackgroundKey;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const resolvedBackground = background ?? getBackgroundForPath(pathname);

  return (
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
        {stats && (
          <div className="g-header-meta">
            {stats.alias && (
              <div className="g-player-line">
                {stats.alias}
                {stats.district ? ` · ${stats.district}` : ''}
              </div>
            )}
            <GlobalStatus stats={stats} />
          </div>
        )}
        <GameNav stats={stats} />
      </div>
      <main className="g-main">
        <Suspense fallback={children}>
          <GameMainTransition>{children}</GameMainTransition>
        </Suspense>
      </main>
      <PlayerShellRefresh />
      <footer className="g-footer">Neon Underworld · OldSkool Edition</footer>
    </div>
  );
}
