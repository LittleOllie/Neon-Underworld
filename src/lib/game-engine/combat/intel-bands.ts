export type Band4 = 'Low' | 'Moderate' | 'High' | 'Massive';
export type ThugPresenceBand = 'Very Low' | 'Low' | 'Moderate' | 'High' | 'Very High' | 'Massive';
export type ExposureBand6 = 'Very Low' | 'Low' | 'Moderate' | 'High' | 'Very High' | 'Extreme';
export type DeepWeaponBand = 'Poorly Armed' | 'Light' | 'Moderate' | 'Well Armed' | 'Heavily Armed';
export type WeaponBand = 'Weak' | 'Armed' | 'Heavily Armed';
export type ProtectionBand = 'None' | 'Light' | 'Strong';

export function thugBand(count: number): ThugPresenceBand {
  if (count >= 2000) return 'Massive';
  if (count >= 500) return 'Very High';
  if (count >= 150) return 'High';
  if (count >= 40) return 'Moderate';
  if (count >= 10) return 'Low';
  return 'Very Low';
}

export function weaponStrengthBand(strength: number, thugs: number): WeaponBand {
  if (thugs <= 0) return 'Weak';
  const perThug = strength / thugs;
  if (perThug >= 20) return 'Heavily Armed';
  if (perThug >= 5) return 'Armed';
  return 'Weak';
}

export function exposureBand(value: number): Band4 {
  if (value >= 250_000) return 'Massive';
  if (value >= 75_000) return 'High';
  if (value >= 20_000) return 'Moderate';
  return 'Low';
}

/** Cash or drug exposure relative to target canonical net worth (0–1 ratio). */
export function nwRelativeExposureBand(ratio: number): ExposureBand6 {
  if (!Number.isFinite(ratio) || ratio <= 0) return 'Very Low';
  if (ratio < 0.05) return 'Very Low';
  if (ratio < 0.15) return 'Low';
  if (ratio < 0.3) return 'Moderate';
  if (ratio < 0.5) return 'High';
  if (ratio < 0.7) return 'Very High';
  return 'Extreme';
}

/** Weapon readiness from usable allocation vs current thugs — ignores idle stockpile. */
export function deepWeaponReadinessBand(
  thugs: number,
  allocation: { armedThugs: number; totalStrength: number },
): DeepWeaponBand {
  if (thugs <= 0) return 'Poorly Armed';
  const armedRatio = allocation.armedThugs / thugs;
  const strengthPerThug = allocation.totalStrength / thugs;
  if (armedRatio < 0.15 && strengthPerThug < 2) return 'Poorly Armed';
  if (armedRatio < 0.35 || strengthPerThug < 5) return 'Light';
  if (armedRatio < 0.6 || strengthPerThug < 12) return 'Moderate';
  if (armedRatio < 0.85 || strengthPerThug < 18) return 'Well Armed';
  return 'Heavily Armed';
}

export function cartelProtectionBand(cartelId: string | null, active: boolean): ProtectionBand {
  if (!cartelId) return 'None';
  if (!active) return 'Light';
  return 'Strong';
}

export type WorkforceStabilityBand =
  | 'Very Stable'
  | 'Stable'
  | 'Unsettled'
  | 'Unhappy'
  | 'Critical';

export function workforceStabilityBand(happinessScore: number): WorkforceStabilityBand {
  const score = Math.max(0, Math.min(100, Math.floor(happinessScore)));
  if (score >= 80) return 'Very Stable';
  if (score >= 60) return 'Stable';
  if (score >= 40) return 'Unsettled';
  if (score >= 20) return 'Unhappy';
  return 'Critical';
}

export function workforceStabilityHint(band: WorkforceStabilityBand): string | null {
  if (band === 'Unsettled' || band === 'Unhappy' || band === 'Critical') {
    return 'Some of this player\'s Workers may be vulnerable to poaching.';
  }
  return null;
}

export function computeConfidencePercent(scoutedAt: Date, expiresAt: Date, now = new Date()): number {
  const total = expiresAt.getTime() - scoutedAt.getTime();
  if (total <= 0) return 50;
  const remaining = expiresAt.getTime() - now.getTime();
  const freshness = Math.max(0, Math.min(1, remaining / total));
  return Math.round(50 + freshness * 50);
}
