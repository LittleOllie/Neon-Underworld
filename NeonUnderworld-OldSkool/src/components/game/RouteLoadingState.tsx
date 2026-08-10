'use client';

import { usePathname } from 'next/navigation';
import { routeLoadingMessage } from '@local/lib/loading-copy';
import { BrandedLoader } from './BrandedLoader';

/** Lightweight content-area placeholder while a game route suspends. */
export function RouteLoadingState() {
  const pathname = usePathname();
  const message = routeLoadingMessage(pathname);

  return (
    <div className="g-route-loading" role="status" aria-live="polite" aria-busy="true">
      <BrandedLoader />
      <p className="g-route-loading__text">{message}</p>
    </div>
  );
}
