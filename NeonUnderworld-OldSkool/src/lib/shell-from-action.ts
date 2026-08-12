import type { PlayerShellSnapshot } from '@local/domain/player-shell.model';

/** Merge explicit shell payload with known action result fields. */
export function resolveShellUpdate(
  data: {
    shell?: Partial<PlayerShellSnapshot>;
    newCash?: number;
    newTurns?: number;
    canonicalNetWorth?: number;
    newNetWorth?: number;
  },
): Partial<PlayerShellSnapshot> {
  const fromFields: Partial<PlayerShellSnapshot> = {
    ...(data.newCash !== undefined ? { cash: data.newCash } : {}),
    ...(data.newTurns !== undefined ? { turns: data.newTurns } : {}),
    ...(data.canonicalNetWorth !== undefined
      ? { netWorth: data.canonicalNetWorth }
      : data.newNetWorth !== undefined
        ? { netWorth: data.newNetWorth }
        : {}),
  };
  return {
    ...fromFields,
    ...(data.shell ?? {}),
  };
}
