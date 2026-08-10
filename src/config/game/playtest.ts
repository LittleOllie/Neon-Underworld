/**
 * Playtest turn grants — disabled in production unless PLAYTEST_TURNS=true.
 * Set PLAYTEST_TURNS=true in local .env for development convenience.
 */
export function isPlaytestTurnsEnabled(): boolean {
  return process.env.PLAYTEST_TURNS === 'true';
}
