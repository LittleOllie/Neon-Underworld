import { REDLITE_CARTEL } from '@/config/game/redlite-rules';
import { CANONICAL_NET_WORTH_VALUATIONS } from '@/lib/game-engine/canonical-net-worth';

export const CARTEL_DONATION_OPTIONS = [0, 10, 20, 30, 40, 50, 60] as const;

/** Cartel-owned assets — NOT member player net worth. */
export interface CartelAssetRecord {
  treasuryCash: number;
  /** Shared cartel thugs purchased from treasury. */
  thugs?: number;
  glocks?: number;
  uzis?: number;
}

/**
 * Cartel net worth — treasury + shared thugs only.
 * Weapons are excluded (same as player NW rules). Member personal NW is separate.
 */
export function calculateCartelNetWorth(assets: CartelAssetRecord): number {
  let total = assets.treasuryCash * CANONICAL_NET_WORTH_VALUATIONS.cash;
  total += (assets.thugs ?? 0) * CANONICAL_NET_WORTH_VALUATIONS.thug;
  return Math.floor(total);
}

/** Read cartel-owned assets from a Cartel row. */
export function cartelAssetsFromRecord(cartel: {
  treasuryCash: number;
  thugs?: number;
  glocks?: number;
  uzis?: number;
}): CartelAssetRecord {
  return {
    treasuryCash: cartel.treasuryCash,
    thugs: cartel.thugs ?? 0,
    glocks: cartel.glocks ?? 0,
    uzis: cartel.uzis ?? 0,
  };
}

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
