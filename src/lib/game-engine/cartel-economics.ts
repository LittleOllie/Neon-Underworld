import { REDLITE_CARTEL } from '@/config/game/redlite-rules';

export const CARTEL_DONATION_OPTIONS = [0, 10, 20, 30, 40, 50, 60] as const;

export function normalizeDonationPercent(percent: number): number {
  if (!Number.isInteger(percent)) return 0;
  return Math.min(REDLITE_CARTEL.maxDonationPercent, Math.max(0, percent));
}

/** Split eligible street income between player and cartel treasury. */
export function applyCartelContribution(
  grossCash: number,
  donationPercent: number,
): { playerCash: number; cartelCash: number } {
  if (grossCash <= 0) return { playerCash: 0, cartelCash: 0 };
  const pct = normalizeDonationPercent(donationPercent);
  const cartelCash = Math.floor(grossCash * (pct / 100));
  return { playerCash: grossCash - cartelCash, cartelCash };
}

/** Virtual thug support from eligible cartel mates (same city, not travelling). */
export function cartelDefenceThugBonus(
  supporters: { thugs: number }[],
  maxSupportFraction = 0.25,
): number {
  if (supporters.length === 0) return 0;
  const total = supporters.reduce((sum, s) => sum + Math.max(0, s.thugs), 0);
  return Math.floor(total * maxSupportFraction);
}
