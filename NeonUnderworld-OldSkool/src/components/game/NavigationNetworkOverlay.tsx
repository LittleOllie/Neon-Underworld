'use client';

import Image from 'next/image';
import {
  NAVIGATION_LOADER_LOGO,
  navigationRouteMessage,
} from '@local/config/navigation-transition';
import { useNavigationTransition } from './NavigationTransitionProvider';

/** Full NU network overlay — only after the slow threshold (~700ms). */
export function NavigationNetworkOverlay() {
  const { phase, destinationPath } = useNavigationTransition();

  if (phase !== 'full') return null;

  const message = navigationRouteMessage(destinationPath ?? '');

  return (
    <div
      className="g-nav-network-overlay"
      role="status"
      aria-live="polite"
      aria-busy="true"
      aria-label={message}
    >
      <div className="g-nav-network-overlay__veil" aria-hidden="true" />
      <div className="g-nav-network-overlay__core">
        <div className="g-nav-network-loader" aria-hidden="true">
          <span className="g-nav-network-loader__ring" />
          <span className="g-nav-network-loader__logo-wrap">
            <Image
              src={NAVIGATION_LOADER_LOGO}
              alt=""
              width={96}
              height={96}
              className="g-nav-network-loader__logo"
              priority
            />
            <span className="g-nav-network-loader__scan" />
          </span>
        </div>
        <p className="g-nav-network-overlay__message">{message}</p>
      </div>
    </div>
  );
}
