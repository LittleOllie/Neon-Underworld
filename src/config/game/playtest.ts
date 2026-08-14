/**
 * Playtest turn grants — disabled unless explicitly enabled.
 * Production: always disabled regardless of env flags.
 */
export function isPlaytestTurnsEnabled(): boolean {
  if (process.env.NODE_ENV === 'production') return false;
  return process.env.PLAYTEST_TURNS === 'true';
}

/** Client nav visibility — must use NEXT_PUBLIC_ prefix for bundled UI. */
export function isPlaytestTurnsNavVisible(): boolean {
  if (process.env.NODE_ENV === 'production') return false;
  return process.env.NEXT_PUBLIC_PLAYTEST_TURNS === 'true';
}
