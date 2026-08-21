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
import { NuScene } from './NuScene';
import { getNuBackgroundForPath } from '@local/config/route-nu-backgrounds';
import { PlayerShellRefresh } from './PlayerShellRefresh';
import { PlayerShellProvider, usePlayerShell } from './PlayerShellProvider';
import { IdentityGate } from './IdentityGate';
import { PlayerAvatar } from './PlayerAvatar';
import {
  playerIdentityCssVars,
  type PlayerIdentityRecord,
} from '@core/lib/game-engine/player-identity';
import { WireControl } from '@local/features/wire/WireControl';
import { SupplyOrderProvider, useSupplyOrder } from '@local/features/shop/useSupplyOrder';
import { GlobalSupplyOrderDock } from '@local/features/shop/GlobalSupplyOrderDock';

export type { GlobalStats };

function GameShellFrame({
  background,
  playerIdentity,
  identityPending,
  wireEnabled,
  children,
}: {
  background?: GameBackgroundKey;
  playerIdentity: PlayerIdentityRecord;
  identityPending: boolean;
  wireEnabled?: boolean;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const { stats } = usePlayerShell();
  const { hasItems: hasSupplyOrder } = useSupplyOrder();
  const nuBackground = getNuBackgroundForPath(pathname);
  const resolvedBackground = nuBackground ? undefined : (background ?? getBackgroundForPath(pathname));
  const onIdentityRoute = pathname.startsWith('/identity');
  const shellThemeStyle = playerIdentityCssVars(playerIdentity) as React.CSSProperties;

  return (
    <IdentityGate avatarPending={identityPending}>
      <div
        className={`g-shell${nuBackground || resolvedBackground ? ' g-shell--bg' : ''}${nuBackground ? ' g-shell--nu-scene' : ''}${onIdentityRoute ? ' g-shell--identity-route' : ''}${hasSupplyOrder ? ' g-shell--supply-dock' : ''}`}
        style={shellThemeStyle}
        data-avatar-theme={playerIdentity.avatarSource ?? 'default'}
      >
          {nuBackground ? (
            <NuScene key={nuBackground} background={nuBackground} />
          ) : resolvedBackground ? (
            <GamePageBackground key={resolvedBackground} background={resolvedBackground} />
          ) : null}
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
                      <PlayerAvatar identity={playerIdentity} alt={stats.alias} size="header" shape="square" />
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
          {!onIdentityRoute && <GlobalSupplyOrderDock />}
          <footer className="g-footer">Neon Underworld · OldSkool Edition</footer>
      </div>
    </IdentityGate>
  );
}

export function GameShell({
  stats,
  background,
  playerIdentity,
  identityPending = false,
  /** @deprecated Use playerIdentity */
  avatarId,
  /** @deprecated Use identityPending */
  avatarPending = false,
  wireEnabled = false,
  children,
}: {
  stats?: GlobalStats;
  background?: GameBackgroundKey;
  playerIdentity?: PlayerIdentityRecord;
  identityPending?: boolean;
  avatarId?: string;
  avatarPending?: boolean;
  wireEnabled?: boolean;
  children: React.ReactNode;
}) {
  const resolvedIdentity: PlayerIdentityRecord = playerIdentity ?? {
    avatar: avatarId ?? null,
    avatarSource: avatarId ? 'CHARACTER' : null,
    pfpUrl: null,
    themePrimary: null,
    themeSecondary: null,
  };
  const pending = identityPending || avatarPending;

  if (!stats) {
    return (
      <div className="g-shell">
        <main className="g-main">{children}</main>
      </div>
    );
  }

  return (
    <PlayerShellProvider initialStats={stats}>
      <SupplyOrderProvider>
        <GameShellFrame
          background={background}
          playerIdentity={resolvedIdentity}
          identityPending={pending}
          wireEnabled={wireEnabled}
        >
          {children}
        </GameShellFrame>
      </SupplyOrderProvider>
    </PlayerShellProvider>
  );
}
