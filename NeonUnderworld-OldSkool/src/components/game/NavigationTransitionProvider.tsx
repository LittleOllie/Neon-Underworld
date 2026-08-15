'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import { NAVIGATION_TRANSITION_THRESHOLDS } from '@local/config/navigation-transition';

export type NavigationTransitionPhase = 'idle' | 'subtle' | 'full';
export type NavigationProgressPhase = 'idle' | 'loading' | 'complete';

export interface NavigationTransitionState {
  phase: NavigationTransitionPhase;
  progressPhase: NavigationProgressPhase;
  destinationPath: string | null;
}

const NavigationTransitionContext = createContext<NavigationTransitionState>({
  phase: 'idle',
  progressPhase: 'idle',
  destinationPath: null,
});

/** Build current route key including search params — fixes stuck dim on filter navigations. */
export function useRouteKey(): string {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const query = searchParams.toString();
  return query ? `${pathname}?${query}` : pathname;
}

export function useNavigationTransition(): NavigationTransitionState {
  return useContext(NavigationTransitionContext);
}

function isInternalNavAnchor(anchor: Element, routeKey: string): URL | null {
  if (anchor.getAttribute('target') === '_blank') return null;

  const href = anchor.getAttribute('href');
  if (!href || href.startsWith('#') || href.startsWith('http')) return null;

  const url = new URL(href, window.location.origin);
  if (url.origin !== window.location.origin) return null;
  if (url.pathname + url.search === routeKey) return null;

  return url;
}

export function NavigationTransitionProvider({ children }: { children: ReactNode }) {
  const routeKey = useRouteKey();
  const [phase, setPhase] = useState<NavigationTransitionPhase>('idle');
  const [progressPhase, setProgressPhase] = useState<NavigationProgressPhase>('idle');
  const [destinationPath, setDestinationPath] = useState<string | null>(null);

  const prevRoute = useRef(routeKey);
  const phaseRef = useRef(phase);
  phaseRef.current = phase;

  const subtleTimer = useRef<number | null>(null);
  const fullTimer = useRef<number | null>(null);
  const timeoutTimer = useRef<number | null>(null);
  const completeTimer = useRef<number | null>(null);

  const clearTimers = useCallback(() => {
    if (subtleTimer.current !== null) {
      window.clearTimeout(subtleTimer.current);
      subtleTimer.current = null;
    }
    if (fullTimer.current !== null) {
      window.clearTimeout(fullTimer.current);
      fullTimer.current = null;
    }
    if (timeoutTimer.current !== null) {
      window.clearTimeout(timeoutTimer.current);
      timeoutTimer.current = null;
    }
    if (completeTimer.current !== null) {
      window.clearTimeout(completeTimer.current);
      completeTimer.current = null;
    }
  }, []);

  const resetTransition = useCallback(() => {
    clearTimers();
    setPhase('idle');
    setDestinationPath(null);
    setProgressPhase('idle');
  }, [clearTimers]);

  useEffect(() => {
    function onNavigateStart(event: MouseEvent) {
      const target = event.target;
      if (!(target instanceof Element)) return;

      const anchor = target.closest('a[href]');
      if (!anchor) return;

      const url = isInternalNavAnchor(anchor, routeKey);
      if (!url) return;

      clearTimers();
      setDestinationPath(url.pathname);
      setPhase('idle');
      setProgressPhase('idle');

      subtleTimer.current = window.setTimeout(() => {
        setPhase('subtle');
        setProgressPhase('loading');
        subtleTimer.current = null;
      }, NAVIGATION_TRANSITION_THRESHOLDS.subtleMs);

      fullTimer.current = window.setTimeout(() => {
        setPhase('full');
        fullTimer.current = null;
      }, NAVIGATION_TRANSITION_THRESHOLDS.fullMs);

      timeoutTimer.current = window.setTimeout(() => {
        resetTransition();
      }, NAVIGATION_TRANSITION_THRESHOLDS.timeoutMs);
    }

    document.addEventListener('click', onNavigateStart, true);
    return () => {
      document.removeEventListener('click', onNavigateStart, true);
      clearTimers();
    };
  }, [routeKey, clearTimers, resetTransition]);

  useEffect(() => {
    if (prevRoute.current === routeKey) return;

    const wasNavigating = phaseRef.current !== 'idle';
    prevRoute.current = routeKey;
    clearTimers();
    setPhase('idle');
    setDestinationPath(null);

    if (!wasNavigating) {
      setProgressPhase('idle');
      return;
    }

    setProgressPhase('complete');
    completeTimer.current = window.setTimeout(() => {
      setProgressPhase('idle');
      completeTimer.current = null;
    }, NAVIGATION_TRANSITION_THRESHOLDS.progressCompleteMs);

    return () => {
      if (completeTimer.current !== null) {
        window.clearTimeout(completeTimer.current);
        completeTimer.current = null;
      }
    };
  }, [routeKey, clearTimers]);

  return (
    <NavigationTransitionContext.Provider value={{ phase, progressPhase, destinationPath }}>
      {children}
    </NavigationTransitionContext.Provider>
  );
}
