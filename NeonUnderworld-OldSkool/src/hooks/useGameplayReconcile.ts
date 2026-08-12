'use client';

import { startTransition, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import type { PlayerShellSnapshot } from '@local/domain/player-shell.model';
import { useOptionalPlayerShell } from '@local/components/game/PlayerShellProvider';

/**
 * Apply authoritative shell values immediately, then reconcile with the server in the background.
 */
export function useGameplayReconcile() {
  const router = useRouter();
  const shell = useOptionalPlayerShell();

  return useCallback(
    (update: Partial<PlayerShellSnapshot>) => {
      shell?.applyShellUpdate(update);
      startTransition(() => {
        router.refresh();
      });
    },
    [router, shell],
  );
}
