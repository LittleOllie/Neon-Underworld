'use client';

import { useCallback, useRef, useState } from 'react';
import { createMutationLockState } from './mutation-lock-core';

/**
 * Synchronous client-side lock for gameplay mutations.
 * Prevents double-submit and conflicting actions while a server action is in flight.
 * Server validation remains authoritative — this is UX/state safety only.
 */
export function useMutationLock() {
  const [, bump] = useState(0);
  const syncRef = useRef<() => void>(() => {});
  syncRef.current = () => bump((n) => n + 1);

  const lockRef = useRef<ReturnType<typeof createMutationLockState>>(null!);
  if (!lockRef.current) {
    lockRef.current = createMutationLockState(() => syncRef.current());
  }

  const locked = lockRef.current.getSnapshot().locked;
  const pendingKey = lockRef.current.getSnapshot().pendingKey;

  const run = useCallback(async (key: string | null, fn: () => Promise<void>): Promise<boolean> => {
    return lockRef.current.run(key, fn);
  }, []);

  return { locked, pendingKey, run };
}
