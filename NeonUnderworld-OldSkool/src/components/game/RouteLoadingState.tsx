'use client';

import { usePathname } from 'next/navigation';
import { routeLoadingMessage } from '@local/lib/loading-copy';
import { getRouteSkeletonVariant } from '@local/lib/route-skeleton';
import { BrandedLoader } from './BrandedLoader';
import { RouteSkeleton } from './RouteSkeleton';

/** Content-area veil + route skeleton while a game route suspends. */
export function RouteLoadingState() {
  const pathname = usePathname();
  const message = routeLoadingMessage(pathname);
  const variant = getRouteSkeletonVariant(pathname);

  return (
    <div className="g-route-transition" role="status" aria-live="polite" aria-busy="true">
      <div className="g-route-transition__veil" aria-hidden="true" />
      <div className="g-route-transition__strip">
        <span className="g-route-transition__chevron" aria-hidden="true">
          ▸
        </span>
        <span className="g-route-transition__label">{message.replace(/…$/, '').toUpperCase()}</span>
        <BrandedLoader size="sm" />
      </div>
      <div className="g-route-transition__skeleton">
        <RouteSkeleton variant={variant} />
      </div>
    </div>
  );
}
