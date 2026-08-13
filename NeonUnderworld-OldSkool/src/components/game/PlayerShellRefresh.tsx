'use client';

import { useCallback, useEffect, useRef } from 'react';
import { usePlayerShell } from './PlayerShellProvider';

/** Targeted shell poll while tab is visible — no full page RSC refresh. */
const SHELL_POLL_MS = 45_000;

export function PlayerShellRefresh() {
  const { applyShellUpdate } = usePlayerShell();
  const lastPoll = useRef(0);
  const polling = useRef(false);

  const pollShell = useCallback(
    async (force = false) => {
      const now = Date.now();
      if (!force && now - lastPoll.current < SHELL_POLL_MS) return;
      if (polling.current) return;

      polling.current = true;
      try {
        const { pollPlayerShellAction } = await import(
          '@local/server/actions/shell-poll.actions'
        );
        const snapshot = await pollPlayerShellAction();
        if (snapshot) {
          applyShellUpdate(snapshot);
          lastPoll.current = Date.now();
        }
      } catch {
        // Ignore transient poll failures — next focus/interval will retry.
      } finally {
        polling.current = false;
      }
    },
    [applyShellUpdate],
  );

  useEffect(() => {
    function onVisibility() {
      if (document.visibilityState === 'visible') {
        void pollShell(true);
      }
    }

    function onFocus() {
      void pollShell(true);
    }

    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('focus', onFocus);

    const interval = window.setInterval(() => {
      if (document.visibilityState === 'visible') {
        void pollShell(false);
      }
    }, SHELL_POLL_MS);

    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('focus', onFocus);
      window.clearInterval(interval);
    };
  }, [pollShell]);

  return null;
}
