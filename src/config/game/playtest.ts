/**
 * Playtest turn grants — disabled unless explicitly enabled.
 * Production: omit PLAYTEST_TURNS (or set false). Alpha: PLAYTEST_TURNS=true.
 */
export function isPlaytestTurnsEnabled(): boolean {
  return process.env.PLAYTEST_TURNS === 'true';
}

/** Client nav visibility — must use NEXT_PUBLIC_ prefix for bundled UI. */
export function isPlaytestTurnsNavVisible(): boolean {
  return process.env.NEXT_PUBLIC_PLAYTEST_TURNS === 'true';
}
