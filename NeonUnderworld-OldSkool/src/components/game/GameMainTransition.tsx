'use client';

import { BrandedLoader } from './BrandedLoader';
import { useNavigationTransition } from './NavigationTransitionProvider';
import { NavigationNetworkOverlay } from './NavigationNetworkOverlay';

export { useRouteKey } from './NavigationTransitionProvider';

/** Delays dim until navigation exceeds ~175ms; full overlay at ~700ms. */
export function GameMainTransition({ children }: { children: React.ReactNode }) {
  const { phase } = useNavigationTransition();
  const pending = phase !== 'idle';

  return (
    <div
      className={`g-main-transition${pending ? ' is-pending' : ''}${phase === 'full' ? ' is-network-pending' : ''}`}
    >
      {children}
      {phase === 'subtle' ? (
        <div className="g-nav-subtle-indicator" aria-hidden="true">
          <BrandedLoader size="sm" />
        </div>
      ) : null}
      <NavigationNetworkOverlay />
    </div>
  );
}
