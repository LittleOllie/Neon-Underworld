/**
 * Canonical OldSkool activity types — single source of truth.
 * Do not use generic RECRUIT for unrelated actions.
 */
export const ACTIVITY_TYPES = {
  LOGIN: 'LOGIN',
  SCOUT: 'SCOUT',
  RECRUIT_THUGS: 'RECRUIT_THUGS',
  RECRUIT_WORKERS: 'RECRUIT_WORKERS',
  PRODUCTION: 'PRODUCTION',
  SHOP_PURCHASE: 'SHOP_PURCHASE',
  MARKET_LISTING: 'MARKET_LISTING',
  MARKET_BID: 'MARKET_BID',
  MARKET_SALE: 'MARKET_SALE',
  TRAVEL: 'TRAVEL',
  ATTACK: 'ATTACK',
  DEFENCE: 'DEFENCE',
  BUSINESS: 'BUSINESS',
  CARTEL: 'CARTEL',
  SYSTEM: 'SYSTEM',
  WORKER_PAYOUT_UPDATED: 'WORKER_PAYOUT_UPDATED',
  BANK_DEPOSIT: 'BANK_DEPOSIT',
  BANK_WITHDRAWAL: 'BANK_WITHDRAWAL',
  PERSONNEL_DISMISSED: 'PERSONNEL_DISMISSED',
  EMPIRE_UPDATED: 'EMPIRE_UPDATED',
} as const;

export type ActivityType = (typeof ACTIVITY_TYPES)[keyof typeof ACTIVITY_TYPES];

/** All valid activity types for runtime validation */
export const ACTIVITY_TYPE_LIST: ActivityType[] = Object.values(ACTIVITY_TYPES);

/** Legacy DB enum values mapped to canonical types (read-only normalisation) */
export const LEGACY_ACTIVITY_MAP: Record<string, ActivityType> = {
  RECRUIT: ACTIVITY_TYPES.SCOUT,
  PURCHASE: ACTIVITY_TYPES.SHOP_PURCHASE,
  PRODUCE: ACTIVITY_TYPES.PRODUCTION,
  MARKET: ACTIVITY_TYPES.MARKET_LISTING,
};

export function normalizeActivityCategory(category: string): ActivityType {
  if (ACTIVITY_TYPE_LIST.includes(category as ActivityType)) {
    return category as ActivityType;
  }
  return LEGACY_ACTIVITY_MAP[category] ?? ACTIVITY_TYPES.SYSTEM;
}

export function buildScoutActivityMessage(data: {
  prostitutesFound: number;
  thugsFound: number;
  cashEarned: number;
}): string {
  return `Scouting complete: +${data.prostitutesFound} workers, +${data.thugsFound} thugs, +$${data.cashEarned.toLocaleString()} cash.`;
}

export function buildPlayerIntelActivityMessage(targetAlias: string): string {
  return `Player intelligence gathered on ${targetAlias}.`;
}

export function buildAttackActivityMessage(
  targetAlias: string,
  attackType: string,
  outcome: string,
): string {
  return `${attackType} against ${targetAlias}: ${outcome}.`;
}

export function buildDefenceActivityMessage(
  attackerAlias: string,
  attackType: string,
  outcome: string,
): string {
  return `Defended against ${attackType} from ${attackerAlias}: ${outcome}.`;
}
