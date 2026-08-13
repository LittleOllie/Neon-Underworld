/** UI bar color for heat: low = good (green), moderate = warn, high/critical = danger. */
export function semanticLevelFromHeatScore(score: number): 'good' | 'warn' | 'danger' {
  const v = Math.round(Math.max(0, Math.min(100, score)));
  if (v <= 24) return 'good';
  if (v <= 49) return 'warn';
  return 'danger';
}

export type BusinessHeatSite = {
  id: string;
  name: string;
  heatScore: number;
  heatBand: string;
  heatLabel: string;
};

export type BusinessSafeFullSite = {
  id: string;
  name: string;
  safeCash: number;
  safeCapacity: number;
};

export type BusinessOperationsSummary = {
  owned: number;
  maxOwned?: number;
  assignedWorkers: number;
  assignedSecurityThugs?: number;
  safeBalance: number;
  totalStoredDrugs?: number;
  safeFullCount?: number;
  safeFullSites?: BusinessSafeFullSite[];
  overCapacityCount?: number;
  criticalHeatCount?: number;
  criticalHeatSites?: Array<{ id: string; name: string }>;
  overallHeat: string;
  overallHeatScore: number;
  sites: BusinessHeatSite[];
};
