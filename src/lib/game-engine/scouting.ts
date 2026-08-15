import { SCOUTING_CONFIG, TURNS_CONFIG } from '@/config/game/balance';
import type { DistrictModifiers } from '@/config/game/balance';
import type { RedliteScoutAreaSlug } from '@/config/game/redlite-rules';
import { getScoutArea } from '@/config/game/redlite-rules';
import { getDistrictScoutAreaName } from '@/config/game/scout-area-names';
import {
  calculateDepartureRisk,
  happinessRecruitmentModifier,
  happinessEfficiencyModifier,
} from '@/lib/game-engine/happiness';
import { createSeededRng } from '@/lib/game-engine/rng';
import { grossWorkerCash, playerCashFromGross } from '@/lib/game-engine/worker-economics';

export interface ScoutAreaModifiers {
  prostituteRecruitment: number;
  thugRecruitment: number;
  resultConsistency: number;
  descriptionTag?: string;
}

export interface BusinessNetworkMultipliers {
  workerMultiplier?: number;
  thugMultiplier?: number;
  workerBonusPercent?: number;
  thugBonusPercent?: number;
}

export interface ScoutInput {
  turnsSpent: number;
  districtModifiers: DistrictModifiers;
  districtSlug?: string;
  areaSlug?: RedliteScoutAreaSlug | string;
  prostituteHappiness: number;
  thugHappiness: number;
  prostituteCount: number;
  thugCount: number;
  prostitutePayoutPercent: number;
  seed: number;
  /** Business Network recruitment bonus — does not affect Scout cash. */
  businessNetwork?: BusinessNetworkMultipliers;
}

export interface ScoutOutcome {
  prostitutesFound: number;
  thugsFound: number;
  cashEarned: number;
  prostitutesLost: number;
  thugsLost: number;
  summary: string;
  businessNetworkWorkerBonusPercent: number;
  businessNetworkThugBonusPercent: number;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export function resolveScouting(input: ScoutInput): ScoutOutcome {
  const rng = createSeededRng(input.seed);
  const { varianceMin, varianceMax } = SCOUTING_CONFIG;

  const area = getScoutArea(input.areaSlug ?? 'streets');
  const areaDisplayName = input.districtSlug
    ? getDistrictScoutAreaName(input.districtSlug, area.slug)
    : area.name;

  const happinessMod = happinessRecruitmentModifier(
    input.prostituteHappiness,
    input.thugHappiness,
  );

  const consistencyMod = input.districtModifiers.resultConsistency * area.resultConsistency;

  const workerNetworkMod = input.businessNetwork?.workerMultiplier ?? 1;
  const thugNetworkMod = input.businessNetwork?.thugMultiplier ?? 1;
  const businessNetworkWorkerBonusPercent = input.businessNetwork?.workerBonusPercent ?? 0;
  const businessNetworkThugBonusPercent = input.businessNetwork?.thugBonusPercent ?? 0;

  const workerChanceBase =
    SCOUTING_CONFIG.baseProstitutesPerTurn *
    input.districtModifiers.prostituteRecruitment *
    area.prostituteRecruitment *
    happinessMod *
    workerNetworkMod;

  const thugChanceBase =
    SCOUTING_CONFIG.baseThugsPerTurn *
    input.districtModifiers.thugRecruitment *
    area.thugRecruitment *
    happinessMod *
    thugNetworkMod;

  let prostitutesFound = 0;
  let thugsFound = 0;

  for (let turn = 0; turn < input.turnsSpent; turn++) {
    const rawVariance = rng.nextFloat(varianceMin, varianceMax);
    const varianceSpread = 1 + (rawVariance - 1) / consistencyMod;

    const workerChance = clamp(workerChanceBase * varianceSpread, 0, 1);
    if (rng.next() < workerChance) prostitutesFound++;

    const thugChance = clamp(thugChanceBase * varianceSpread, 0, 1);
    if (rng.next() < thugChance) thugsFound++;
  }

  const grossCash = grossWorkerCash(input.prostituteCount, input.turnsSpent);
  const crewEfficiency = happinessEfficiencyModifier(
    (input.prostituteHappiness + input.thugHappiness) / 2,
  );
  const cashEarned = Math.floor(
    playerCashFromGross(grossCash, input.prostitutePayoutPercent) * crewEfficiency,
  );

  const { prostitutesLost, thugsLost } = calculateDepartureRisk(
    input.turnsSpent,
    input.prostituteHappiness,
    input.thugHappiness,
    input.prostituteCount,
    input.thugCount,
    rng,
  );

  const summary = buildScoutSummary({
    prostitutesFound,
    thugsFound,
    cashEarned,
    prostitutesLost,
    thugsLost,
    districtTag: input.districtModifiers.descriptionTag,
    areaName: areaDisplayName,
    prostitutesLabel: 'prostitutes',
  });

  return {
    prostitutesFound,
    thugsFound,
    cashEarned,
    prostitutesLost,
    thugsLost,
    summary,
    businessNetworkWorkerBonusPercent,
    businessNetworkThugBonusPercent,
  };
}

function buildScoutSummary(params: {
  prostitutesFound: number;
  thugsFound: number;
  cashEarned: number;
  prostitutesLost: number;
  thugsLost: number;
  districtTag: string;
  areaName?: string;
  prostitutesLabel?: string;
}): string {
  const parts: string[] = [];

  if (params.prostitutesFound > 0 || params.thugsFound > 0) {
    parts.push(
      params.areaName
        ? `Your crew returned from ${params.areaName} with new recruits.`
        : 'Your crew returned with new recruits.',
    );
  } else {
    parts.push('The streets were quiet — no significant recruitment today.');
  }

  if (params.cashEarned > 0) {
    parts.push(`Operations generated $${params.cashEarned.toLocaleString()} while scouting.`);
  }

  if (params.prostitutesLost > 0) {
    parts.push(`${params.prostitutesLost} ${params.prostitutesLabel ?? 'prostitutes'} walked out because morale became critically low.`);
  }

  if (params.thugsLost > 0) {
    parts.push(`${params.thugsLost} thugs walked out because morale became critically low.`);
  }

  return parts.join(' ');
}

export function validateScoutAmount(
  amount: number,
  availableTurns: number,
): { valid: boolean; error?: string } {
  if (!Number.isInteger(amount)) {
    return { valid: false, error: 'Turn amount must be a whole number' };
  }
  if (amount < TURNS_CONFIG.minScoutSpend) {
    return { valid: false, error: `Minimum scout spend is ${TURNS_CONFIG.minScoutSpend} turns` };
  }
  if (amount > TURNS_CONFIG.maxScoutSpend) {
    return { valid: false, error: `Maximum scout spend is ${TURNS_CONFIG.maxScoutSpend} turns per action` };
  }
  if (amount > availableTurns) {
    return { valid: false, error: 'Insufficient turns' };
  }
  return { valid: true };
}
