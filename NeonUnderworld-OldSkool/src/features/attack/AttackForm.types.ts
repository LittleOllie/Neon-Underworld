export interface AttackTargetRow {
  reportId: string;
  alias: string;
  city: string;
  bands: {
    thugs: string;
    weapons: string;
    cash: string;
    drugs: string;
    cartel: string;
    confidence: number;
  };
  netWorthEstimate: number;
  reportAge: string;
  attacksOnTarget: number;
  eligible: boolean;
  eligibilityNote: string;
  isDirect?: boolean;
}
