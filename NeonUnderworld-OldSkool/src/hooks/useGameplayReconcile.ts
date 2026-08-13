'use client';

import { useCallback } from 'react';
import type { PlayerShellSnapshot } from '@local/domain/player-shell.model';
import { useOptionalPlayerShell } from '@local/components/game/PlayerShellProvider';

/**
 * Apply authoritative shell values from a mutation response immediately.
 * Page-specific data should update from the action payload or a local refetch —
 * not via a full layout refresh on every action.
 */
export function useGameplayReconcile() {
  const shell = useOptionalPlayerShell();

  return useCallback(
    (update: Partial<PlayerShellSnapshot>) => {
      shell?.applyShellUpdate(update);
    },
    [shell],
  );
}
