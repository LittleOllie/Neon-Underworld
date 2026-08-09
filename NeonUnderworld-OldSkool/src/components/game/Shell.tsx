'use client';

import Link from 'next/link';
import { LogoutLink } from '@local/components/oldskool/LogoutLink';
import type { GameBackgroundKey } from '@local/config/backgrounds';
import { GlobalStatus, type GlobalStats } from './GlobalStatus';
import { GameNav } from './GameNav';
import { GamePageBackground } from './GamePageBackground';

export type { GlobalStats };

export function GameShell({
  stats,
  background,
  children,
}: {
  stats?: GlobalStats;
  background?: GameBackgroundKey;
  children: React.ReactNode;
}) {
  return (
    <div className={`g-shell${background ? ' g-shell--bg' : ''}`}>
      {background && <GamePageBackground key={background} background={background} />}
      <div className="g-top">
        <div className="g-brand-row">
          <Link href="/command" className="g-brand">
            NEON UNDERWORLD
          </Link>
          <LogoutLink />
        </div>
        {stats && (
          <>
            {stats.alias && (
              <div className="g-player-line">
                {stats.alias}
                {stats.district ? ` · ${stats.district}` : ''}
              </div>
            )}
            <GlobalStatus stats={stats} />
          </>
        )}
        <GameNav />
      </div>
      <main className="g-main">{children}</main>
      <footer className="g-footer">Neon Underworld · OldSkool Edition</footer>
    </div>
  );
}
