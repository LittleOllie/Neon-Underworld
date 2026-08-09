import { REDLITE_SCOUT_AREAS, type RedliteScoutAreaSlug } from '@/config/game/redlite-rules';

export type RecruitmentTier = 'High' | 'Medium' | 'Low';

function recruitmentTier(multiplier: number): RecruitmentTier {
  if (multiplier >= 1.12) return 'High';
  if (multiplier <= 0.92) return 'Low';
  return 'Medium';
}

function riskTier(consistency: number, workerTier: RecruitmentTier): 'Low' | 'Medium' | 'High' {
  if (consistency >= 1.1 && workerTier !== 'High') return 'Medium';
  if (consistency < 0.98) return 'Medium';
  return 'Low';
}

export interface ScoutAreaDisplay {
  slug: RedliteScoutAreaSlug;
  name: string;
  tagline: string;
  workers: RecruitmentTier;
  thugs: RecruitmentTier;
  risk: 'Low' | 'Medium' | 'High';
}

export function getScoutAreaDisplays(): ScoutAreaDisplay[] {
  return REDLITE_SCOUT_AREAS.map((area) => {
    const workers = recruitmentTier(area.prostituteRecruitment);
    const thugs = recruitmentTier(area.thugRecruitment);
    return {
      slug: area.slug,
      name: area.name.toUpperCase(),
      tagline: area.description,
      workers,
      thugs,
      risk: riskTier(area.resultConsistency, workers),
    };
  });
}
