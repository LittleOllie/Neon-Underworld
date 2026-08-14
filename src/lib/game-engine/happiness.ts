import { HAPPINESS_CONFIG, SCOUTING_CONFIG, HAPPINESS_EFFICIENCY } from '@/config/game/balance';
import { payoutMoraleScore } from '@/lib/game-engine/payout-morale';
import type { DistrictModifiers } from '@/config/game/balance';

export interface ProstituteHappinessInput {
  prostitutes: number;
  thugs: number;
  hash: number;
  condoms: number;
  prostitutePayoutPercent: number;
  /** Hash production: treat hash supply as satisfied for morale on this action */
  exemptHashMorale?: boolean;
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

  const hashReadiness = input.exemptHashMorale
    ? 1
    : clamp(input.hash / Math.max(hashNeeded, 1), 0, 1);
  const condomReadiness = clamp(input.condoms / Math.max(condomNeeded, 1), 0, 1);
  const protectionReadiness = clamp(input.thugs / Math.max(thugsNeeded, 1), 0, 1);

  const payoutScore = payoutMoraleScore(input.prostitutePayoutPercent);

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

/** Smooth efficiency curve for scout cash and produce output. 100% ≈ full, low morale reduces returns. */
export function happinessEfficiencyModifier(score: number): number {
  const s = clamp(score, 0, 100);
  const cfg = HAPPINESS_EFFICIENCY;
  if (s >= cfg.excellentMin) {
    const t = (s - cfg.excellentMin) / (100 - cfg.excellentMin);
    return cfg.atGood + t * (cfg.atExcellent - cfg.atGood);
  }
  if (s >= cfg.goodMin) {
    const t = (s - cfg.goodMin) / (cfg.excellentMin - cfg.goodMin);
    return cfg.atReduced + t * (cfg.atGood - cfg.atReduced);
  }
  if (s >= cfg.reducedMin) {
    const t = (s - cfg.reducedMin) / (cfg.goodMin - cfg.reducedMin);
    return cfg.atPoor + t * (cfg.atReduced - cfg.atPoor);
  }
  if (s >= cfg.poorMin) {
    const t = (s - cfg.poorMin) / (cfg.reducedMin - cfg.poorMin);
    return cfg.atSevere + t * (cfg.atPoor - cfg.atSevere);
  }
  return cfg.atSevere;
}

function walkoutRateForHappiness(happiness: number, baseRate: number): number {
  const cfg = SCOUTING_CONFIG;
  if (happiness >= cfg.walkoutHealthyThreshold) return 0;
  if (happiness >= cfg.walkoutModerateThreshold) {
    return baseRate * cfg.walkoutModerateRateMultiplier;
  }
  if (happiness >= cfg.walkoutLowThreshold) {
    return baseRate * cfg.walkoutLowRateMultiplier;
  }
  return baseRate * cfg.walkoutCriticalRateMultiplier;
}

function rollWalkouts(
  crewCount: number,
  turnsSpent: number,
  ratePerTurn: number,
  rng?: { next(): number },
): number {
  if (ratePerTurn <= 0 || crewCount <= 0 || turnsSpent <= 0) return 0;

  if (!rng) {
    return Math.min(crewCount, Math.floor(crewCount * ratePerTurn * turnsSpent));
  }

  let lost = 0;
  let remaining = crewCount;
  for (let turn = 0; turn < turnsSpent; turn++) {
    for (let i = 0; i < remaining; i++) {
      if (rng.next() < ratePerTurn) {
        lost++;
        remaining--;
        if (remaining <= 0) break;
      }
    }
    if (remaining <= 0) break;
  }
  return lost;
}

function capWalkoutLosses(lost: number, crewCount: number): number {
  if (crewCount <= 0) return 0;
  const maxLoss = Math.ceil(crewCount * SCOUTING_CONFIG.maxWalkoutFractionPerAction);
  return Math.min(lost, maxLoss, crewCount);
}

export function assessScoutWalkoutRisk(
  turnsSpent: number,
  prostituteHappiness: number,
  thugHappiness: number,
  prostituteCount: number,
  thugCount: number,
): { level: 'none' | 'warning' | 'critical'; message?: string } {
  if (turnsSpent <= 0) return { level: 'none' };

  const prostituteRisk = walkoutRateForHappiness(
    prostituteHappiness,
    SCOUTING_CONFIG.prostituteDepartureRatePerTurn,
  );
  const thugRisk = walkoutRateForHappiness(
    thugHappiness,
    SCOUTING_CONFIG.thugDepartureRatePerTurn,
  );

  const workerCritical =
    prostituteCount > 0 &&
    prostituteHappiness < SCOUTING_CONFIG.prostituteHappinessCriticalThreshold &&
    prostituteRisk > 0;
  const thugCritical =
    thugCount > 0 &&
    thugHappiness < SCOUTING_CONFIG.thugHappinessCriticalThreshold &&
    thugRisk > 0;

  if (workerCritical || thugCritical) {
    const parts: string[] = [];
    if (workerCritical) {
      parts.push('workers are critically unhappy and may leave');
    }
    if (thugCritical) {
      parts.push('thugs are critically unhappy and may leave');
    }
    return {
      level: 'critical',
      message: `Low morale — ${parts.join('; ')} during a large action.`,
    };
  }

  const workerWarning =
    prostituteCount > 0 &&
    prostituteHappiness < SCOUTING_CONFIG.prostituteHappinessWarningThreshold;
  const thugWarning =
    thugCount > 0 && thugHappiness < SCOUTING_CONFIG.thugHappinessWarningThreshold;

  if ((workerWarning || thugWarning) && turnsSpent >= 100) {
    return {
      level: 'warning',
      message: 'Morale is low. A large action increases walkout risk.',
    };
  }

  return { level: 'none' };
}

export function calculateDepartureRisk(
  turnsSpent: number,
  prostituteHappiness: number,
  thugHappiness: number,
  prostituteCount: number,
  thugCount: number,
  rng?: { next(): number },
): { prostitutesLost: number; thugsLost: number } {
  if (prostituteHappiness >= SCOUTING_CONFIG.walkoutHealthyThreshold) {
    return { prostitutesLost: 0, thugsLost: 0 };
  }

  let prostituteRate = walkoutRateForHappiness(
    prostituteHappiness,
    SCOUTING_CONFIG.prostituteDepartureRatePerTurn,
  );
  let thugRate = walkoutRateForHappiness(thugHappiness, SCOUTING_CONFIG.thugDepartureRatePerTurn);

  if (
    prostituteCount > 0 &&
    prostituteCount < SCOUTING_CONFIG.newPlayerProtectionProstituteCount &&
    prostituteHappiness < SCOUTING_CONFIG.prostituteHappinessCriticalThreshold
  ) {
    prostituteRate *= SCOUTING_CONFIG.newPlayerDepartureMultiplier;
  }

  if (thugHappiness >= SCOUTING_CONFIG.walkoutHealthyThreshold) {
    thugRate = 0;
  } else if (thugHappiness < SCOUTING_CONFIG.thugHappinessWarningThreshold) {
    thugRate = Math.max(
      thugRate,
      SCOUTING_CONFIG.thugDepartureRatePerTurn * SCOUTING_CONFIG.walkoutLowRateMultiplier,
    );
  }

  const prostitutesLost =
    prostituteRate > 0
      ? capWalkoutLosses(
          rollWalkouts(prostituteCount, turnsSpent, prostituteRate, rng),
          prostituteCount,
        )
      : 0;
  const thugsLost =
    thugRate > 0
      ? capWalkoutLosses(rollWalkouts(thugCount, turnsSpent, thugRate, rng), thugCount)
      : 0;

  return { prostitutesLost, thugsLost };
}

export type { DistrictModifiers };
