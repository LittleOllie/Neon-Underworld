import { SCOUTING_CONFIG } from '@/config/game/balance';

/** Gross cash workers generate before payout split */
export function grossWorkerCash(
  prostituteCount: number,
  turnsSpent: number,
  cashPerProstitutePerTurn = SCOUTING_CONFIG.cashPerProstitutePerTurn,
): number {
  return prostituteCount * cashPerProstitutePerTurn * turnsSpent;
}

/**
 * Redlite: low payout (e.g. 1%) keeps more cash with the player;
 * high payout (100%) protects workers when idle.
 */
export function playerCashFromGross(grossCash: number, payoutPercent: number): number {
  const payout = Math.max(0, Math.min(100, payoutPercent));
  const playerShare = (100 - payout) / 100;
  return Math.floor(grossCash * playerShare);
}

export function workerShareFromGross(grossCash: number, payoutPercent: number): number {
  return grossCash - playerCashFromGross(grossCash, payoutPercent);
}

export function workerCashBreakdown(
  prostituteCount: number,
  turnsSpent: number,
  payoutPercent: number,
): { gross: number; workerShare: number; playerShare: number } {
  const gross = grossWorkerCash(prostituteCount, turnsSpent);
  const playerShare = playerCashFromGross(gross, payoutPercent);
  return {
    gross,
    workerShare: gross - playerShare,
    playerShare,
  };
}
