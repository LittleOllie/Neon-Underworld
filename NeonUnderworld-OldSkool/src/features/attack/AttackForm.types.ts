export interface AttackTargetBands {
  thugs: string;
  weapons: string;
  cash: string;
  drugs: string;
  cartel: string;
  confidence: number;
}

export interface DeepIntelDisplay {
  reportId: string;
  estimatedThugMin: number;
  estimatedThugMax: number;
  estimatedWorkerMin: number;
  estimatedWorkerMax: number;
  weaponReadinessBand: string;
  cashExposureBand: string;
  drugExposureBand: string;
  cartelPresence: string | null;
  workforceStabilityBand: string;
  workforceProtectionBand: string;
  poachingOutlook: string;
  gatheredAt: string;
}

/** Same-city player eligible for attack discovery. */
export interface AttackTargetCandidate {
  playerId: string;
  alias: string;
  aliasNormalized: string;
  avatarId: string;
  rank: number;
  netWorth: number;
  online: boolean;
  statusLabel: string;
  hasIntel: boolean;
  reportId: string | null;
  bands: AttackTargetBands | null;
  hasDeepIntel: boolean;
  deepIntelReportId: string | null;
  deepIntel: DeepIntelDisplay | null;
  eligible: boolean;
  eligibilityNote: string;
  attacksOnTarget: number;
}

/** @deprecated Legacy row shape — use AttackTargetCandidate */
export interface AttackTargetRow {
  reportId: string;
  alias: string;
  city: string;
  bands: AttackTargetBands;
  netWorthEstimate: number;
  reportAge: string;
  attacksOnTarget: number;
  eligible: boolean;
  eligibilityNote: string;
  isDirect?: boolean;
}
