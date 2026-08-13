import type { BusinessLevelStats } from '@/config/game/business-levels';

export type SecurityStatusBand = 'NONE' | 'LIGHT' | 'MODERATE' | 'STRONG' | 'HEAVY';

export const SECURITY_MAX_RAID_CHANCE_REDUCTION = 0.35;
export const SECURITY_MAX_RAID_LOSS_REDUCTION = 0.4;

/** Coverage 0–1 from assigned / capacity. */
export function securityCoverage(assignedThugs: number, securityCapacity: number): number {
  if (securityCapacity <= 0 || assignedThugs <= 0) return 0;
  return Math.min(1, assignedThugs / securityCapacity);
}

export function securityStatusBand(coverage: number): SecurityStatusBand {
  const pct = coverage * 100;
  if (pct <= 0) return 'NONE';
  if (pct < 25) return 'LIGHT';
  if (pct < 50) return 'MODERATE';
  if (pct < 75) return 'STRONG';
  return 'HEAVY';
}

/** Relative raid chance multiplier (1 = no change, 0.65 = 35% reduction). */
export function securityRaidChanceMultiplier(
  coverage: number,
  levelStats: Pick<BusinessLevelStats, 'levelRaidChanceReduction'>,
): number {
  const fromSecurity = coverage * 0.2;
  const totalReduction = Math.min(
    SECURITY_MAX_RAID_CHANCE_REDUCTION,
    fromSecurity + levelStats.levelRaidChanceReduction,
  );
  return 1 - totalReduction;
}

/** Relative loss multiplier when raided (1 = full losses). */
export function securityRaidLossMultiplier(
  coverage: number,
  levelStats: Pick<BusinessLevelStats, 'levelSecurityLossReduction'>,
): number {
  const fromSecurity = coverage * 0.3;
  const totalReduction = Math.min(
    SECURITY_MAX_RAID_LOSS_REDUCTION,
    fromSecurity + levelStats.levelSecurityLossReduction,
  );
  return 1 - totalReduction;
}

/** Additional heat from security presence (0–12). */
export function securityHeatContribution(
  assignedThugs: number,
  securityCapacity: number,
): number {
  if (assignedThugs <= 0 || securityCapacity <= 0) return 0;
  const coverage = securityCoverage(assignedThugs, securityCapacity);
  if (coverage <= 0.5) return coverage * 4;
  const over = Math.max(0, assignedThugs / securityCapacity - 1);
  return 4 + (coverage - 0.5) * 16 + over * 4;
}
