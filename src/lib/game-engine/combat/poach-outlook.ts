import type { DeepIntelSnapshot } from './deep-intel';
import type { PoachingOutlook } from '@/config/game/worker-poaching-rules';
import type { WorkforceStabilityBand } from './intel-bands';

/** Client-safe poaching outlook — derived from deep intel bands only, never exact counts. */
export function computePoachingOutlook(deepIntel: {
  workforceStabilityBand: WorkforceStabilityBand;
  workforceProtectionBand: string;
  weaponReadinessBand: string;
  cartelPresence: string | null;
}): PoachingOutlook {
  let score = stabilityScore(deepIntel.workforceStabilityBand);
  score += protectionScore(deepIntel.workforceProtectionBand);
  score += weaponScore(deepIntel.weaponReadinessBand);
  if (deepIntel.cartelPresence) score -= 0.75;

  if (score >= 8) return 'Highly Vulnerable';
  if (score >= 6.5) return 'Promising';
  if (score >= 5) return 'Possible';
  if (score >= 3.5) return 'Risky';
  return 'Poor';
}

export function poachingOutlookHint(outlook: PoachingOutlook): string {
  switch (outlook) {
    case 'Highly Vulnerable':
      return 'Workforce may be highly vulnerable to poaching.';
    case 'Promising':
      return 'Poaching could yield Workers if your crew wins the fight.';
    case 'Possible':
      return 'Some Workers may be poachable with a strong attack.';
    case 'Risky':
      return 'Protection or morale may limit poaching gains.';
    default:
      return 'Poaching outlook is poor — target likely well protected.';
  }
}

function stabilityScore(band: WorkforceStabilityBand): number {
  switch (band) {
    case 'Critical':
      return 2.5;
    case 'Unhappy':
      return 2;
    case 'Unsettled':
      return 1.5;
    case 'Stable':
      return 0.75;
    default:
      return 0;
  }
}

function protectionScore(band: string): number {
  switch (band) {
    case 'Very Weak':
      return 2.5;
    case 'Weak':
      return 2;
    case 'Moderate':
      return 1.25;
    case 'Good':
      return 0.5;
    case 'Strong':
      return 0;
    default:
      return 1;
  }
}

function weaponScore(band: string): number {
  switch (band) {
    case 'Poorly Armed':
      return 1.5;
    case 'Light':
      return 1;
    case 'Moderate':
      return 0.5;
    default:
      return 0;
  }
}

/** Estimate protection band from deep intel ranges (worst-case for attacker = min thugs / max workers). */
export function estimateProtectionBandFromRanges(
  estimatedThugMin: number,
  estimatedWorkerMax: number,
  cartelPresence: string | null,
): string {
  if (estimatedWorkerMax <= 0) return 'Strong';
  const ratio = estimatedThugMin / estimatedWorkerMax;
  let band: string;
  if (ratio >= 0.75) band = 'Strong';
  else if (ratio >= 0.5) band = 'Good';
  else if (ratio >= 0.25) band = 'Moderate';
  else if (ratio >= 0.1) band = 'Weak';
  else band = 'Very Weak';

  if (cartelPresence && band !== 'Strong') {
    const order = ['Very Weak', 'Weak', 'Moderate', 'Good', 'Strong'];
    const idx = order.indexOf(band);
    if (idx >= 0 && idx < order.length - 1) band = order[idx + 1]!;
  }
  return band;
}

export type DeepIntelPoachPreview = Pick<
  DeepIntelSnapshot,
  | 'estimatedWorkerMin'
  | 'estimatedWorkerMax'
  | 'workforceStabilityBand'
  | 'workforceProtectionBand'
  | 'weaponReadinessBand'
  | 'cartelPresence'
>;
