/**
 * Presentation-only status mapping — deterministic display scores from real inputs.
 * Does not alter gameplay; rounds to whole percentages.
 */

import { supplyBand } from '@core/lib/game-engine/supply-status';
import type { PlayerInventoryRow } from './empire-calculations';
import { buildEmpireSupplySummary, calculateArming } from './empire-calculations';
import { calculateProstituteHappiness, calculateThugHappiness } from '@core/lib/game-engine/happiness';

export type StatusMeterBand =
  | 'critical'
  | 'low'
  | 'adequate'
  | 'stable'
  | 'excellent';

export interface StatusMeterPresentation {
  label: string;
  value: number;
  band: StatusMeterBand;
  statusText: string;
  supportingText?: string;
}

/** Map 0–100 happiness score to display band */
export function bandFromPercent(value: number): StatusMeterBand {
  const v = Math.round(Math.max(0, Math.min(100, value)));
  if (v <= 24) return 'critical';
  if (v <= 49) return 'low';
  if (v <= 69) return 'adequate';
  if (v <= 84) return 'stable';
  return 'excellent';
}

export function statusTextFromBand(band: StatusMeterBand): string {
  switch (band) {
    case 'critical':
      return 'Critical';
    case 'low':
      return 'Low';
    case 'adequate':
      return 'Adequate';
    case 'stable':
      return 'Stable';
    case 'excellent':
      return 'Excellent';
  }
}

/** Map 0–1 readiness ratio to 0–100 display score */
export function readinessToPercent(readiness: number): number {
  return Math.round(Math.max(0, Math.min(1, readiness)) * 100);
}

export function supplyReadinessToPercent(readiness: number): number {
  return readinessToPercent(readiness);
}

export function buildWorkerStabilityMeter(player: PlayerInventoryRow): StatusMeterPresentation {
  const happy = calculateProstituteHappiness({
    prostitutes: player.prostitutes,
    thugs: player.thugs,
    hash: player.hash,
    condoms: player.condoms,
    prostitutePayoutPercent: player.prostitutePayoutPercent,
  });
  const value = Math.round(happy.score);
  const band = bandFromPercent(value);
  let supporting: string | undefined;
  if (happy.condomReadiness < 0.4) supporting = 'Condom supply is low.';
  else if (happy.hashReadiness < 0.4) supporting = 'Hash supply is low.';
  else if (happy.protectionReadiness < 0.4) supporting = 'Protection supply is low.';
  return {
    label: 'Worker Stability',
    value,
    band,
    statusText: statusTextFromBand(band),
    supportingText: supporting,
  };
}

export function buildWorkerSuppliesMeter(player: PlayerInventoryRow): StatusMeterPresentation {
  const happy = calculateProstituteHappiness({
    prostitutes: player.prostitutes,
    thugs: player.thugs,
    hash: player.hash,
    condoms: player.condoms,
    prostitutePayoutPercent: player.prostitutePayoutPercent,
  });
  const avg =
    (happy.hashReadiness + happy.condomReadiness + happy.protectionReadiness) / 3;
  const value = supplyReadinessToPercent(avg);
  const band = bandFromPercent(value);
  const hashBand = supplyBand(happy.hashReadiness);
  const condomBand = supplyBand(happy.condomReadiness);
  return {
    label: 'Worker Supplies',
    value,
    band,
    statusText: statusTextFromBand(band),
    supportingText: `Hash ${hashBand.toLowerCase()} · Condoms ${condomBand.toLowerCase()}`,
  };
}

export function buildWorkerProtectionMeter(player: PlayerInventoryRow): StatusMeterPresentation {
  const happy = calculateProstituteHappiness({
    prostitutes: player.prostitutes,
    thugs: player.thugs,
    hash: player.hash,
    condoms: player.condoms,
    prostitutePayoutPercent: player.prostitutePayoutPercent,
  });
  const value = supplyReadinessToPercent(happy.protectionReadiness);
  const band = bandFromPercent(value);
  return {
    label: 'Worker Protection',
    value,
    band,
    statusText: statusTextFromBand(band),
  };
}

export function buildWorkerPayoutMeter(player: PlayerInventoryRow): StatusMeterPresentation {
  const payout = player.prostitutePayoutPercent;
  const value = payout;
  let band: StatusMeterBand;
  if (payout <= 25) band = 'adequate';
  else if (payout <= 50) band = 'stable';
  else if (payout <= 75) band = 'stable';
  else band = 'excellent';
  const retention =
    payout <= 30 ? 'High profit' : payout >= 70 ? 'Defensive payout' : 'Balanced share';
  const stability =
    payout <= 30 ? 'Lower stability' : payout >= 70 ? 'Higher stability' : 'Moderate stability';
  return {
    label: 'Worker Payout',
    value,
    band,
    statusText: `${payout}%`,
    supportingText: `${retention} · ${stability}`,
  };
}

export function buildThugStabilityMeter(player: PlayerInventoryRow): StatusMeterPresentation {
  const happy = calculateThugHappiness({
    thugs: player.thugs,
    glocks: player.glocks,
    uzis: player.uzis,
    aks: player.aks,
    beer: player.beer,
  });
  const value = Math.round(happy.score);
  const band = bandFromPercent(value);
  return {
    label: 'Thug Stability',
    value,
    band,
    statusText: statusTextFromBand(band),
    supportingText: happy.beerReadiness < 0.4 ? 'Beer supply is low.' : undefined,
  };
}

export function buildWeaponCoverageMeter(player: PlayerInventoryRow): StatusMeterPresentation {
  const arming = calculateArming(player.thugs, player.glocks, player.uzis, player.aks);
  const value =
    player.thugs <= 0 ? 0 : Math.round((arming.armedThugs / player.thugs) * 100);
  const band = bandFromPercent(value);
  return {
    label: 'Weapon Coverage',
    value,
    band,
    statusText: statusTextFromBand(band),
    supportingText:
      arming.unarmedThugs > 0
        ? `${arming.unarmedThugs} thug${arming.unarmedThugs === 1 ? '' : 's'} unarmed.`
        : player.thugs > 0
          ? 'All thugs armed.'
          : undefined,
  };
}

export function buildBeerSupplyMeter(player: PlayerInventoryRow): StatusMeterPresentation {
  const happy = calculateThugHappiness({
    thugs: player.thugs,
    glocks: player.glocks,
    uzis: player.uzis,
    aks: player.aks,
    beer: player.beer,
  });
  const value = supplyReadinessToPercent(happy.beerReadiness);
  const band = bandFromPercent(value);
  return {
    label: 'Beer Supply',
    value,
    band,
    statusText: supplyBand(happy.beerReadiness),
    supportingText: value < 40 ? 'Buy beer in City Shop.' : undefined,
  };
}

export function buildEmpireStatusMeters(player: PlayerInventoryRow) {
  return {
    worker: {
      stability: buildWorkerStabilityMeter(player),
      supplies: buildWorkerSuppliesMeter(player),
      protection: buildWorkerProtectionMeter(player),
      payout: buildWorkerPayoutMeter(player),
    },
    thug: {
      stability: buildThugStabilityMeter(player),
      weaponCoverage: buildWeaponCoverageMeter(player),
      beer: buildBeerSupplyMeter(player),
    },
    summary: buildEmpireSupplySummary(player),
  };
}

/** UI bar color: good (75+), warn (40–74), danger (0–39) */
export function semanticLevelFromPercent(value: number): 'good' | 'warn' | 'danger' {
  const v = Math.round(Math.max(0, Math.min(100, value)));
  if (v >= 75) return 'good';
  if (v >= 40) return 'warn';
  return 'danger';
}

export function supplyLabelFromReadiness(readiness: number): string {
  return supplyBand(readiness);
}

export function semanticToneFromBandLabel(label: string): 'good' | 'warn' | 'danger' | undefined {
  const normalized = label.trim().toLowerCase();
  if (['excellent', 'good', 'stable', 'adequate'].includes(normalized)) return 'good';
  if (['low', 'warning', 'warn', 'amber'].includes(normalized)) return 'warn';
  if (['critical', 'danger', 'severe'].includes(normalized)) return 'danger';
  return undefined;
}

export function formatTurnsExact(current: number, cap: number): string {
  return `${current.toLocaleString()} / ${cap.toLocaleString()}`;
}

export function abbreviateCash(amount: number): string {
  if (amount >= 1_000_000) return `$${(amount / 1_000_000).toFixed(1)}M`;
  if (amount >= 10_000) return `$${Math.round(amount / 1000)}K`;
  return `$${amount.toLocaleString()}`;
}

export function abbreviateTurns(current: number, cap?: number): string {
  if (cap) return formatTurnsExact(current, cap);
  return current.toLocaleString();
}
