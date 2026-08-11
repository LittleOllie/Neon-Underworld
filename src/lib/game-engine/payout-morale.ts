/** Worker payout → morale band (20% of worker happiness score). */

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

/**
 * 1.0 ≈ fair (45–70%), lower payout reduces morale, generous payout improves it.
 * Lowest payout is not optimal — pairs with reduced recruitment efficiency.
 */
export function payoutMoraleScore(payoutPercent: number): number {
  const p = clamp(payoutPercent, 1, 100);
  if (p <= 10) return 0.52;
  if (p <= 25) return 0.52 + ((p - 10) / 15) * (0.68 - 0.52);
  if (p <= 40) return 0.68 + ((p - 25) / 15) * (0.86 - 0.68);
  if (p <= 55) return 0.86 + ((p - 40) / 15) * (1.0 - 0.86);
  if (p <= 75) return 1.0;
  return 1.0;
}

export function payoutMoraleLabel(payoutPercent: number): string {
  const score = payoutMoraleScore(payoutPercent);
  if (score >= 0.95) return 'Positive';
  if (score >= 0.82) return 'Balanced';
  if (score >= 0.68) return 'Slightly negative';
  if (score >= 0.58) return 'Low morale pressure';
  return 'Very poor morale';
}

export function playerRetentionPercent(payoutPercent: number): number {
  return clamp(100 - payoutPercent, 0, 99);
}
