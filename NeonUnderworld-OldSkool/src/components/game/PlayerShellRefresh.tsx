'use client';

import { useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';

const FOCUS_REFRESH_MS = 30_000;

/** Refresh shell stats when returning to the app or on a modest interval while active. */
export function PlayerShellRefresh() {
  const router = useRouter();
  const lastRefresh = useRef(0);

  useEffect(() => {
    function maybeRefresh(force = false) {
      const now = Date.now();
      if (!force && now - lastRefresh.current < FOCUS_REFRESH_MS) return;
      lastRefresh.current = now;
      router.refresh();
    }

    function onVisibility() {
      if (document.visibilityState === 'visible') {
        maybeRefresh(true);
      }
    }

    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('focus', () => maybeRefresh(true));

    const interval = window.setInterval(() => {
      if (document.visibilityState === 'visible') {
        maybeRefresh(false);
      }
    }, FOCUS_REFRESH_MS);

    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('focus', () => maybeRefresh(true));
      window.clearInterval(interval);
    };
  }, [router]);

  return null;
}
