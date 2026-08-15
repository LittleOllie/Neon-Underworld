export type MutationLockRunner = {
  locked: boolean;
  pendingKey: string | null;
  run: (key: string | null, fn: () => Promise<void>) => Promise<boolean>;
};

/** Testable synchronous guard — ref-backed in the React hook wrapper. */
export function createMutationLockState(onChange?: () => void): {
  getSnapshot: () => { locked: boolean; pendingKey: string | null };
  run: (key: string | null, fn: () => Promise<void>) => Promise<boolean>;
} {
  let inFlight = false;
  let pendingKey: string | null = null;

  return {
    getSnapshot: () => ({ locked: inFlight, pendingKey }),
    async run(key, fn) {
      if (inFlight) return false;
      inFlight = true;
      pendingKey = key ?? 'mutation';
      onChange?.();
      try {
        await fn();
        return true;
      } finally {
        inFlight = false;
        pendingKey = null;
        onChange?.();
      }
    },
  };
}
