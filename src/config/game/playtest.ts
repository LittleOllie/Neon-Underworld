/**
 * Playtest turn grants — on by default during alpha so players can top up turns.
 * Set PLAYTEST_TURNS=false (and NEXT_PUBLIC_PLAYTEST_TURNS=false) to disable.
 */
export function isPlaytestTurnsEnabled(): boolean {
  return process.env.PLAYTEST_TURNS !== 'false';
}

/** Client nav visibility — must use NEXT_PUBLIC_ prefix for bundled UI. */
export function isPlaytestTurnsNavVisible(): boolean {
  return process.env.NEXT_PUBLIC_PLAYTEST_TURNS !== 'false';
}
