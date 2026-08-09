export type Band4 = 'Low' | 'Moderate' | 'High' | 'Massive';
export type WeaponBand = 'Weak' | 'Armed' | 'Heavily Armed';
export type ProtectionBand = 'None' | 'Light' | 'Strong';

export function thugBand(count: number): Band4 {
  if (count >= 500) return 'Massive';
  if (count >= 150) return 'High';
  if (count >= 40) return 'Moderate';
  return 'Low';
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

export function cartelProtectionBand(cartelId: string | null, active: boolean): ProtectionBand {
  if (!cartelId) return 'None';
  if (!active) return 'Light';
  return 'Strong';
}

export function computeConfidencePercent(scoutedAt: Date, expiresAt: Date, now = new Date()): number {
  const total = expiresAt.getTime() - scoutedAt.getTime();
  if (total <= 0) return 50;
  const remaining = expiresAt.getTime() - now.getTime();
  const freshness = Math.max(0, Math.min(1, remaining / total));
  return Math.round(50 + freshness * 50);
}
