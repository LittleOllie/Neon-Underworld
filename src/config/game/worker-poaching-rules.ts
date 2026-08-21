/** Worker Poaching — centralized rules (Attack type POACH_WORKERS). */

export const WORKER_POACHING_RULES = {
  /** Turn cost — canonical value in ATTACK_RULES.turnCosts.POACH_WORKERS (12). */
  turnCost: 12,

  /** Targets below this Worker count cannot be poached. */
  minWorkersToPoach: 25,

  /** Baseline fraction of defender Workers considered on a strong successful poach. */
  basePoachPercent: 0.02,

  /** Hard cap per successful poach — never exceed this fraction of target Workers. */
  maxPoachPercent: 0.03,

  /** Attacker survival ratio floor (matches cash/drug theft gate). */
  minSurvivalRatio: 0.3,

  /** Small-player absolute caps after percentage math. */
  smallPlayerCaps: {
    /** Workers 25–49 */
    tierUnder50Max: 1,
    /** Workers 50–99 */
    tierUnder100Max: 2,
  },

  /** Worker happiness score → poach vulnerability multiplier. */
  happinessMultipliers: [
    { minScore: 80, multiplier: 0.25 },
    { minScore: 60, multiplier: 0.6 },
    { minScore: 40, multiplier: 1.0 },
    { minScore: 20, multiplier: 1.3 },
    { minScore: 0, multiplier: 1.5 },
  ] as const,

  /**
   * Thug-to-Worker protection ratio bands (defender thugs incl. cartel virtual support / workers).
   * Lower multiplier = harder to poach.
   */
  protectionRatioBands: [
    { minRatio: 0.75, multiplier: 0.25, band: 'Strong' as const },
    { minRatio: 0.5, multiplier: 0.5, band: 'Good' as const },
    { minRatio: 0.25, multiplier: 0.75, band: 'Moderate' as const },
    { minRatio: 0.1, multiplier: 1.0, band: 'Weak' as const },
    { minRatio: 0, multiplier: 1.25, band: 'Very Weak' as const },
  ] as const,

  /** Controlled RNG on effective poach percent. */
  rngVarianceMin: 0.85,
  rngVarianceMax: 1.15,

  /** Upper fraction of max cap that counts as "strong success" for outcome copy. */
  strongSuccessFractionOfCap: 0.85,
} as const;

export type WorkforceProtectionBand =
  (typeof WORKER_POACHING_RULES.protectionRatioBands)[number]['band'];

export type PoachingOutlook =
  | 'Poor'
  | 'Risky'
  | 'Possible'
  | 'Promising'
  | 'Highly Vulnerable';

export function happinessPoachMultiplier(happinessScore: number): number {
  const score = Math.max(0, Math.min(100, Math.floor(happinessScore)));
  for (const row of WORKER_POACHING_RULES.happinessMultipliers) {
    if (score >= row.minScore) return row.multiplier;
  }
  return 1.5;
}

export function protectionRatio(thugs: number, workers: number): number {
  if (workers <= 0) return 1;
  return Math.max(0, thugs) / workers;
}

export function protectionPoachMultiplier(ratio: number): number {
  for (const row of WORKER_POACHING_RULES.protectionRatioBands) {
    if (ratio >= row.minRatio) return row.multiplier;
  }
  return 1.25;
}

export function workforceProtectionBand(thugs: number, workers: number): WorkforceProtectionBand {
  const ratio = protectionRatio(thugs, workers);
  for (const row of WORKER_POACHING_RULES.protectionRatioBands) {
    if (ratio >= row.minRatio) return row.band;
  }
  return 'Very Weak';
}

/** Apply tier caps for small targets. */
export function capPoachedWorkers(stolen: number, defenderWorkers: number): number {
  if (defenderWorkers < WORKER_POACHING_RULES.minWorkersToPoach) return 0;
  if (defenderWorkers < 50) {
    return Math.min(stolen, WORKER_POACHING_RULES.smallPlayerCaps.tierUnder50Max);
  }
  if (defenderWorkers < 100) {
    return Math.min(stolen, WORKER_POACHING_RULES.smallPlayerCaps.tierUnder100Max);
  }
  const hardCap = Math.floor(defenderWorkers * WORKER_POACHING_RULES.maxPoachPercent);
  return Math.min(stolen, hardCap, defenderWorkers);
}
