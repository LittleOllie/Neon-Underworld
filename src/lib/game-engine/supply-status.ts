/** Player-facing supply / morale bands — formulas stay in happiness engine */

export type StatusBand = 'Excellent' | 'Stable' | 'Unsettled' | 'Critical';

export type SupplyBand = 'Adequate' | 'Low' | 'Critical';

export function happinessBand(score: number): StatusBand {
  if (score >= 80) return 'Excellent';
  if (score >= 60) return 'Stable';
  if (score >= 40) return 'Unsettled';
  return 'Critical';
}

export function supplyBand(readiness: number): SupplyBand {
  if (readiness >= 0.75) return 'Adequate';
  if (readiness >= 0.4) return 'Low';
  return 'Critical';
}

import {
  payoutMoraleLabel,
  payoutMoraleScore,
  playerRetentionPercent,
} from '@/lib/game-engine/payout-morale';

export function payoutTradeOffDescription(payoutPercent: number): {
  playerRetention: string;
  workerStability: string;
  moraleEffect: string;
} {
  return {
    playerRetention: `You keep ${playerRetentionPercent(payoutPercent)}% of worker street income.`,
    workerStability: `Morale effect: ${payoutMoraleLabel(payoutPercent)}.`,
    moraleEffect: payoutMoraleLabel(payoutPercent),
  };
}

export function previewPayoutMoraleScore(payoutPercent: number): number {
  return Math.round(payoutMoraleScore(payoutPercent) * 100);
}
