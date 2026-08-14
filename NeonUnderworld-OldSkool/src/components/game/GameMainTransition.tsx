'use client';

import { useEffect, useRef, useState } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';

const PENDING_TIMEOUT_MS = 10_000;
const PENDING_DIM_DELAY_MS = 175;

/** Build current route key including search params — fixes stuck dim on filter navigations. */
export function useRouteKey(): string {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const query = searchParams.toString();
  return query ? `${pathname}?${query}` : pathname;
}

/** Delays dim until navigation exceeds ~175ms so fast routes feel instant. */
export function GameMainTransition({ children }: { children: React.ReactNode }) {
  const routeKey = useRouteKey();
  const [pending, setPending] = useState(false);
  const prevRoute = useRef(routeKey);
  const pendingTimer = useRef<number | null>(null);
  const dimTimer = useRef<number | null>(null);

  useEffect(() => {
    function clearPendingTimer() {
      if (pendingTimer.current !== null) {
        window.clearTimeout(pendingTimer.current);
        pendingTimer.current = null;
      }
    }

    function clearDimTimer() {
      if (dimTimer.current !== null) {
        window.clearTimeout(dimTimer.current);
        dimTimer.current = null;
      }
    }

    function clearAll() {
      clearPendingTimer();
      clearDimTimer();
      setPending(false);
    }

    function onNavigateStart(event: MouseEvent) {
      const target = event.target;
      if (!(target instanceof Element)) return;

      const anchor = target.closest('a[href]');
      if (!anchor || anchor.getAttribute('target') === '_blank') return;

      const href = anchor.getAttribute('href');
      if (!href || href.startsWith('#') || href.startsWith('http')) return;

      const url = new URL(href, window.location.origin);
      if (url.origin !== window.location.origin) return;
      if (url.pathname + url.search === routeKey) return;

      clearAll();
      dimTimer.current = window.setTimeout(() => {
        setPending(true);
        dimTimer.current = null;
      }, PENDING_DIM_DELAY_MS);
      pendingTimer.current = window.setTimeout(() => {
        clearAll();
      }, PENDING_TIMEOUT_MS);
    }

    document.addEventListener('click', onNavigateStart, true);
    return () => {
      document.removeEventListener('click', onNavigateStart, true);
      clearAll();
    };
  }, [routeKey]);

  useEffect(() => {
    if (prevRoute.current === routeKey) return;
    prevRoute.current = routeKey;
    setPending(false);
    if (pendingTimer.current !== null) {
      window.clearTimeout(pendingTimer.current);
      pendingTimer.current = null;
    }
    if (dimTimer.current !== null) {
      window.clearTimeout(dimTimer.current);
      dimTimer.current = null;
    }
  }, [routeKey]);

  return (
    <div className={`g-main-transition${pending ? ' is-pending' : ''}`}>{children}</div>
  );
}
