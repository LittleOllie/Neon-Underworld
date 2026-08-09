import { HAPPINESS_CONFIG, SCOUTING_CONFIG } from '@/config/game/balance';
import type { DistrictModifiers } from '@/config/game/balance';

export interface ProstituteHappinessInput {
  prostitutes: number;
  thugs: number;
  hash: number;
  condoms: number;
  prostitutePayoutPercent: number;
}

export interface ThugHappinessInput {
  thugs: number;
  glocks: number;
  uzis: number;
  aks: number;
  beer: number;
}

export interface HappinessResult {
  score: number;
  hashReadiness: number;
  condomReadiness: number;
  protectionReadiness: number;
  weaponReadiness: number;
  beerReadiness: number;
  warnings: string[];
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export function calculateProstituteHappiness(input: ProstituteHappinessInput): HappinessResult {
  const { prostitute: cfg } = HAPPINESS_CONFIG;
  const count = input.prostitutes;

  if (count === 0) {
    return {
      score: 70,
      hashReadiness: 1,
      condomReadiness: 1,
      protectionReadiness: 1,
      weaponReadiness: 0,
      beerReadiness: 0,
      warnings: [],
    };
  }

  const hashNeeded = count * cfg.hashPerWorker;
  const condomNeeded = count * cfg.condomPerWorker;
  const thugsNeeded = Math.ceil(count * cfg.thugProtectionRatio);

  const hashReadiness = clamp(input.hash / Math.max(hashNeeded, 1), 0, 1);
  const condomReadiness = clamp(input.condoms / Math.max(condomNeeded, 1), 0, 1);
  const protectionReadiness = clamp(input.thugs / Math.max(thugsNeeded, 1), 0, 1);

  let payoutScore = 1;
  if (input.prostitutePayoutPercent < cfg.optimalPayoutMin) {
    payoutScore -= (cfg.optimalPayoutMin - input.prostitutePayoutPercent) * cfg.payoutPenaltyPerPoint;
  } else if (input.prostitutePayoutPercent > cfg.optimalPayoutMax) {
    payoutScore -= (input.prostitutePayoutPercent - cfg.optimalPayoutMax) * cfg.payoutPenaltyPerPoint;
  }
  payoutScore = clamp(payoutScore, 0.5, 1);

  const score = Math.round(
    (hashReadiness * 0.3 + condomReadiness * 0.25 + protectionReadiness * 0.25 + payoutScore * 0.2) *
      100,
  );

  const warnings: string[] = [];
  if (hashReadiness < 0.5) warnings.push('Hash supplies running low');
  if (condomReadiness < 0.5) warnings.push('Condom stock insufficient');
  if (protectionReadiness < 0.5) warnings.push('Insufficient thug protection');
  if (score < SCOUTING_CONFIG.prostituteHappinessWarningThreshold) {
    warnings.push('Prostitute morale is declining');
  }

  return {
    score,
    hashReadiness,
    condomReadiness,
    protectionReadiness,
    weaponReadiness: 0,
    beerReadiness: 0,
    warnings,
  };
}

export function calculateThugHappiness(input: ThugHappinessInput): HappinessResult {
  const { thug: cfg } = HAPPINESS_CONFIG;
  const count = input.thugs;

  if (count === 0) {
    return {
      score: 70,
      hashReadiness: 0,
      condomReadiness: 0,
      protectionReadiness: 0,
      weaponReadiness: 1,
      beerReadiness: 1,
      warnings: [],
    };
  }

  const weaponPoints = input.glocks * cfg.glockCoverage + input.uzis * cfg.uziCoverage + input.aks * cfg.akCoverage;
  const weaponReadiness = clamp(weaponPoints / count, 0, 1);
  const beerNeeded = count * cfg.beerPerWorker;
  const beerReadiness = clamp(input.beer / Math.max(beerNeeded, 1), 0, 1);

  const score = Math.round((weaponReadiness * 0.6 + beerReadiness * 0.4) * 100);

  const warnings: string[] = [];
  if (weaponReadiness < 1) warnings.push('Some thugs are unarmed');
  if (beerReadiness < 0.5) warnings.push('Beer supplies low');
  if (score < SCOUTING_CONFIG.thugHappinessWarningThreshold) {
    warnings.push('Thug readiness is compromised');
  }

  return { score, hashReadiness: 0, condomReadiness: 0, protectionReadiness: 0, weaponReadiness, beerReadiness, warnings };
}

export function happinessRecruitmentModifier(prostituteHappiness: number, thugHappiness: number): number {
  const avg = (prostituteHappiness + thugHappiness) / 2;
  const { happinessRecruitmentMin, happinessRecruitmentMax } = SCOUTING_CONFIG;
  const normalized = avg / 100;
  return happinessRecruitmentMin + normalized * (happinessRecruitmentMax - happinessRecruitmentMin);
}

export function calculateDepartureRisk(
  turnsSpent: number,
  prostituteHappiness: number,
  thugHappiness: number,
  prostituteCount: number,
  thugCount: number,
): { prostitutesLost: number; thugsLost: number } {
  let prostituteRate = 0;
  let thugRate = 0;

  if (prostituteHappiness < SCOUTING_CONFIG.prostituteHappinessCriticalThreshold && prostituteCount > 0) {
    prostituteRate = SCOUTING_CONFIG.prostituteDepartureRatePerTurn;
    if (prostituteCount < SCOUTING_CONFIG.newPlayerProtectionProstituteCount) {
      prostituteRate *= SCOUTING_CONFIG.newPlayerDepartureMultiplier;
    }
  }

  if (thugHappiness < SCOUTING_CONFIG.thugHappinessWarningThreshold && thugCount > 0) {
    thugRate = SCOUTING_CONFIG.thugDepartureRatePerTurn;
  }

  const prostitutesLost = prostituteRate > 0 ? Math.min(prostituteCount, Math.floor(prostituteCount * prostituteRate * turnsSpent)) : 0;
  const thugsLost = thugRate > 0 ? Math.min(thugCount, Math.floor(thugCount * thugRate * turnsSpent)) : 0;

  return { prostitutesLost, thugsLost };
}

export type { DistrictModifiers };
