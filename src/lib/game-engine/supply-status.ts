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

export function payoutTradeOffDescription(payoutPercent: number): {
  playerRetention: string;
  workerStability: string;
} {
  if (payoutPercent <= 20) {
    return {
      playerRetention: 'You keep most worker-generated cash.',
      workerStability: 'Worker stability is reduced.',
    };
  }
  if (payoutPercent >= 80) {
    return {
      playerRetention: 'You keep little worker-generated cash.',
      workerStability: 'Worker stability improves — defensive payout.',
    };
  }
  return {
    playerRetention: 'Balanced cash retention from worker operations.',
    workerStability: 'Moderate worker stability.',
  };
}
