'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouteKey } from './GameMainTransition';

const PENDING_TIMEOUT_MS = 10_000;
const PENDING_LOADING_DELAY_MS = 175;

export function NavigationProgress() {
  const routeKey = useRouteKey();
  const [phase, setPhase] = useState<'idle' | 'loading' | 'complete'>('idle');
  const prevRoute = useRef(routeKey);
  const pendingTimer = useRef<number | null>(null);
  const loadingTimer = useRef<number | null>(null);

  useEffect(() => {
    function clearPendingTimer() {
      if (pendingTimer.current !== null) {
        window.clearTimeout(pendingTimer.current);
        pendingTimer.current = null;
      }
    }

    function clearLoadingTimer() {
      if (loadingTimer.current !== null) {
        window.clearTimeout(loadingTimer.current);
        loadingTimer.current = null;
      }
    }

    function clearAll() {
      clearPendingTimer();
      clearLoadingTimer();
      setPhase('idle');
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
      loadingTimer.current = window.setTimeout(() => {
        setPhase('loading');
        loadingTimer.current = null;
      }, PENDING_LOADING_DELAY_MS);
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

    if (loadingTimer.current !== null) {
      window.clearTimeout(loadingTimer.current);
      loadingTimer.current = null;
    }
    if (pendingTimer.current !== null) {
      window.clearTimeout(pendingTimer.current);
      pendingTimer.current = null;
    }

    if (phase !== 'loading') {
      setPhase('idle');
      return;
    }

    setPhase('complete');
    const timer = window.setTimeout(() => setPhase('idle'), 220);
    return () => window.clearTimeout(timer);
  }, [routeKey, phase]);

  if (phase === 'idle') return null;

  return (
    <div
      className={`g-nav-progress${phase === 'loading' ? ' is-loading' : ' is-complete'}`}
      aria-hidden="true"
    />
  );
}
