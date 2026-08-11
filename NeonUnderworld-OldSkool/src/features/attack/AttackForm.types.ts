export interface AttackTargetBands {
  thugs: string;
  weapons: string;
  cash: string;
  drugs: string;
  cartel: string;
  confidence: number;
}

/** Same-city player eligible for attack discovery. */
export interface AttackTargetCandidate {
  playerId: string;
  alias: string;
  aliasNormalized: string;
  rank: number;
  netWorth: number;
  online: boolean;
  statusLabel: string;
  hasIntel: boolean;
  reportId: string | null;
  bands: AttackTargetBands | null;
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
