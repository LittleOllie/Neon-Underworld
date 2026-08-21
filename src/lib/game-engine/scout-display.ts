import { REDLITE_SCOUT_AREAS, type RedliteScoutAreaSlug } from '@/config/game/redlite-rules';
import { getDistrictScoutAreaName } from '@/config/game/scout-area-names';

export type RecruitmentTier = 'High' | 'Medium' | 'Low';

export type ScoutRiskTier = 'Low' | 'Medium' | 'High';

function recruitmentTier(multiplier: number): RecruitmentTier {
  if (multiplier >= 1.12) return 'High';
  if (multiplier <= 0.92) return 'Low';
  return 'Medium';
}

function riskTier(consistency: number, workerTier: RecruitmentTier): ScoutRiskTier {
  if (consistency >= 1.1 && workerTier !== 'High') return 'Medium';
  if (consistency < 0.98) return 'Medium';
  return 'Low';
}

/** Visual bar fill for recruitment tiers (higher yield = fuller bar). */
export function scoutRecruitmentTierPercent(tier: RecruitmentTier): number {
  if (tier === 'High') return 100;
  if (tier === 'Medium') return 55;
  return 28;
}

/** Visual bar fill for risk tiers (higher risk = fuller bar). */
export function scoutRiskTierPercent(tier: ScoutRiskTier): number {
  if (tier === 'High') return 100;
  if (tier === 'Medium') return 58;
  return 28;
}

export interface ScoutAreaDisplay {
  slug: RedliteScoutAreaSlug;
  name: string;
  tagline: string;
  workers: RecruitmentTier;
  thugs: RecruitmentTier;
  risk: ScoutRiskTier;
}

export function getScoutAreaDisplays(districtSlug?: string): ScoutAreaDisplay[] {
  return REDLITE_SCOUT_AREAS.map((area) => {
    const workers = recruitmentTier(area.prostituteRecruitment);
    const thugs = recruitmentTier(area.thugRecruitment);
    const name = districtSlug
      ? getDistrictScoutAreaName(districtSlug, area.slug)
      : area.name;
    return {
      slug: area.slug,
      name,
      tagline: area.description,
      workers,
      thugs,
      risk: riskTier(area.resultConsistency, workers),
    };
  });
}
