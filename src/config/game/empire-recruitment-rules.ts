import type { BusinessType } from '@prisma/client';
import {
  calculateBusinessNetworkBonus,
  type BusinessNetworkBonus,
} from './business-recruitment-rules';

/** Empire-driven Scout recruitment — scales with organisation, not calendar day. */
export const EMPIRE_RECRUITMENT_CONFIG = {
  /** Modest global base bump applied before network + empire factors. */
  baseWorkerScale: 1.55,
  baseThugScale: 1.48,
  /** Smooth staffing contribution — full capacity staffed adds up to +48%. */
  staffingMaxBonus: 0.48,
  /** Crew-size curve — logarithmic, capped. */
  workerCrewLogWeight: 0.62,
  workerCrewLogDivisor: 185,
  thugCrewLogWeight: 0.42,
  thugCrewLogDivisor: 130,
  /** Portfolio depth from total business levels (8× L5 ≈ 40 levels). */
  portfolioMaxBonus: 0.65,
  portfolioLevelDivisor: 18,
  /** Hard cap on empire factor (prevents runaway snowball). */
  maxEmpireFactor: 3.0,
} as const;

export type EmpireStrengthBand =
  | 'STREET'
  | 'GROWING'
  | 'ESTABLISHED'
  | 'ORGANISATION'
  | 'EMPIRE';

export interface EmpireRecruitmentInput {
  businesses: Array<{ businessType: BusinessType; level: number }>;
  workers: number;
  thugs: number;
  assignedWorkers: number;
}

export interface EmpireRecruitmentMultipliers {
  workerMultiplier: number;
  thugMultiplier: number;
  workerBonusPercent: number;
  thugBonusPercent: number;
  empireFactor: number;
  workerEmpireFactor: number;
  thugEmpireFactor: number;
  strengthBand: EmpireStrengthBand;
  strengthLabel: string;
  totalWorkerCapacity: number;
}

function smoothStaffingBonus(staffedRatio: number): number {
  const r = Math.max(0, Math.min(1, staffedRatio));
  return 1 + r * EMPIRE_RECRUITMENT_CONFIG.staffingMaxBonus;
}

function smoothCrewBonus(crewSize: number, weight: number, divisor: number): number {
  if (crewSize <= 0 || weight <= 0) return 1;
  const normalized = Math.log10(1 + crewSize / divisor);
  const cap = Math.log10(1 + 25_000 / divisor);
  return 1 + (normalized / cap) * weight;
}

function smoothPortfolioBonus(totalBusinessLevels: number): number {
  if (totalBusinessLevels <= 0) return 1;
  const normalized = Math.min(1, totalBusinessLevels / EMPIRE_RECRUITMENT_CONFIG.portfolioLevelDivisor);
  return 1 + normalized * EMPIRE_RECRUITMENT_CONFIG.portfolioMaxBonus;
}

export function computeEmpireFactor(
  input: EmpireRecruitmentInput,
  workerCapacity: number,
): {
  combined: number;
  worker: number;
  thug: number;
} {
  const staffedRatio = workerCapacity > 0 ? input.assignedWorkers / workerCapacity : 0;
  const staffing = smoothStaffingBonus(staffedRatio);
  const workerCrew = smoothCrewBonus(
    input.workers,
    EMPIRE_RECRUITMENT_CONFIG.workerCrewLogWeight,
    EMPIRE_RECRUITMENT_CONFIG.workerCrewLogDivisor,
  );
  const thugCrew = smoothCrewBonus(
    input.thugs,
    EMPIRE_RECRUITMENT_CONFIG.thugCrewLogWeight,
    EMPIRE_RECRUITMENT_CONFIG.thugCrewLogDivisor,
  );
  const totalLevels = input.businesses.reduce((s, b) => s + b.level, 0);
  const portfolio = smoothPortfolioBonus(totalLevels);

  const workerRaw = staffing * workerCrew * portfolio;
  const thugRaw = staffing * thugCrew * portfolio;
  const cap = EMPIRE_RECRUITMENT_CONFIG.maxEmpireFactor;

  return {
    combined: Math.min(cap, Math.sqrt(workerRaw * thugRaw)),
    worker: Math.min(cap, workerRaw),
    thug: Math.min(cap, thugRaw),
  };
}

export function empireStrengthBand(
  network: BusinessNetworkBonus,
  empireFactor: number,
): EmpireStrengthBand {
  const score = network.workerBonusPercent + network.thugBonusPercent + (empireFactor - 1) * 40;
  if (score >= 120) return 'EMPIRE';
  if (score >= 60) return 'ORGANISATION';
  if (score >= 25) return 'ESTABLISHED';
  if (score >= 8) return 'GROWING';
  return 'STREET';
}

export const EMPIRE_STRENGTH_LABELS: Record<EmpireStrengthBand, string> = {
  STREET: 'Street operation',
  GROWING: 'Growing crew',
  ESTABLISHED: 'Established network',
  ORGANISATION: 'Major organisation',
  EMPIRE: 'Criminal empire',
};

export function calculateEmpireRecruitmentMultipliers(
  input: EmpireRecruitmentInput,
): EmpireRecruitmentMultipliers {
  const network = calculateBusinessNetworkBonus(input.businesses);
  const factors = computeEmpireFactor(input, network.totalWorkerCapacity);
  const strengthBand = empireStrengthBand(network, factors.combined);

  const workerMultiplier =
    EMPIRE_RECRUITMENT_CONFIG.baseWorkerScale *
    network.workerMultiplier *
    factors.worker;
  const thugMultiplier =
    EMPIRE_RECRUITMENT_CONFIG.baseThugScale *
    network.thugMultiplier *
    factors.thug;

  return {
    workerMultiplier,
    thugMultiplier,
    workerBonusPercent: network.workerBonusPercent,
    thugBonusPercent: network.thugBonusPercent,
    empireFactor: Math.round(factors.combined * 1000) / 1000,
    workerEmpireFactor: Math.round(factors.worker * 1000) / 1000,
    thugEmpireFactor: Math.round(factors.thug * 1000) / 1000,
    strengthBand,
    strengthLabel: EMPIRE_STRENGTH_LABELS[strengthBand],
    totalWorkerCapacity: network.totalWorkerCapacity,
  };
}
