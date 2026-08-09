import {
  REDLITE_NET_WORTH,
  REDLITE_PRODUCTION,
  REDLITE_SCOUT_AREAS,
  REDLITE_TURNS,
} from './redlite-rules';

/** Net worth unit values — aligned with Redlite guide §5 */
export const NET_WORTH_VALUES = {
  cash: REDLITE_NET_WORTH.cash,
  prostitutes: REDLITE_NET_WORTH.prostitutes,
  thugs: REDLITE_NET_WORTH.thugs,
  rides: REDLITE_NET_WORTH.rides,
  hash: REDLITE_NET_WORTH.hash,
  shrooms: REDLITE_NET_WORTH.shrooms,
  coke: REDLITE_NET_WORTH.coke,
  heroin: REDLITE_NET_WORTH.heroin,
} as const;

export type NetWorthResource = keyof typeof NET_WORTH_VALUES;

export interface PlayerResources {
  cash: number;
  prostitutes: number;
  thugs: number;
  rides: number;
  hash: number;
  shrooms: number;
  coke: number;
  heroin: number;
}

export const TURNS_CONFIG = {
  startingTurns: REDLITE_TURNS.startingTurns,
  /** Redlite: 2 turns every 6 minutes (~480/day) */
  regenerationRatePerHour: REDLITE_TURNS.regenerationRatePerHour,
  regenerationRatePerMs: REDLITE_TURNS.regenerationRatePerMs,
  turnCap: REDLITE_TURNS.turnCap,
  minScoutSpend: 1,
  maxScoutSpend: 5000,
  suggestedAmounts: [25, 50, 100, 250] as const,
} as const;

/** Five scout areas per city — Redlite guide §2 */
export const SCOUT_AREAS = REDLITE_SCOUT_AREAS;

export const PRODUCTION_CONFIG = {
  ...REDLITE_PRODUCTION,
  minTurnSpend: 1,
  maxTurnSpend: 5000,
} as const;

export const STARTING_RESOURCES = {
  cash: 2500,
  prostitutes: 2,
  thugs: 1,
  rides: 0,
  glocks: 1,
  uzis: 0,
  aks: 0,
  beer: 5,
  condoms: 10,
  hash: 5,
  shrooms: 0,
  coke: 0,
  heroin: 0,
  prostitutePayoutPercent: 50,
  prostituteHappiness: 72,
  thugHappiness: 68,
} as const;

export const SCOUTING_CONFIG = {
  /** Per-turn recruitment chance before district/area/happiness modifiers (0–1 scale). */
  baseProstitutesPerTurn: 0.12,
  baseThugsPerTurn: 0.11,
  varianceMin: 0.6,
  varianceMax: 1.4,
  cashPerProstitutePerTurn: REDLITE_PRODUCTION.cashPerProstitutePerTurn,
  maxProstitutesPerAction: 50,
  maxThugsPerAction: 40,
  /** Below this happiness, departure risk increases */
  prostituteHappinessWarningThreshold: 45,
  prostituteHappinessCriticalThreshold: 30,
  thugHappinessWarningThreshold: 40,
  /** Base departure chance per turn when happiness is critical (0-1) */
  prostituteDepartureRatePerTurn: 0.0008,
  thugDepartureRatePerTurn: 0.0003,
  /** New players with fewer than this many prostitutes get reduced departure risk */
  newPlayerProtectionProstituteCount: 5,
  newPlayerDepartureMultiplier: 0.25,
  /** Happiness modifier range applied to recruitment */
  happinessRecruitmentMin: 0.75,
  happinessRecruitmentMax: 1.15,
} as const;

export const HAPPINESS_CONFIG = {
  prostitute: {
    hashPerWorker: 1,
    condomPerWorker: 2,
    thugProtectionRatio: 0.05,
    /** Redlite: happiness from supplies; payout affects cash split, not morale band */
    optimalPayoutMin: 1,
    optimalPayoutMax: 100,
    payoutPenaltyPerPoint: 0,
  },
  thug: {
    glockCoverage: 1,
    uziCoverage: 2,
    akCoverage: 3,
    beerPerWorker: 1,
  },
} as const;

export const AUTH_CONFIG = {
  passwordMinLength: 8,
  aliasMinLength: 3,
  aliasMaxLength: 20,
  aliasPattern: /^[a-zA-Z0-9_]+$/,
  loginRateLimitWindowMs: 15 * 60 * 1000,
  loginRateLimitMaxAttempts: 10,
} as const;

export const LABELS = {
  prostitutes: 'Prostitutes',
  thugs: 'Thugs',
  brothels: 'Brothels',
  coffeeShops: 'Coffee Shops',
  hash: 'Hash',
  shrooms: 'Shrooms',
  coke: 'Coke',
  heroin: 'Heroin',
  glocks: 'Glocks',
  uzis: 'Uzis',
  aks: 'AKs',
  rides: 'Rides',
  cartels: 'Cartels',
} as const;

export interface DistrictModifiers {
  prostituteRecruitment: number;
  thugRecruitment: number;
  resultConsistency: number;
  descriptionTag: string;
}

export const DISTRICTS: Array<{
  slug: string;
  name: string;
  description: string;
  modifiers: DistrictModifiers;
}> = [
  {
    slug: 'neon-strip',
    name: 'Neon Strip',
    description:
      'Neon-lit boulevards and velvet doorways. Nightlife runs deep — recruitment favours those who work the strip.',
    modifiers: {
      prostituteRecruitment: 1.12,
      thugRecruitment: 1.0,
      resultConsistency: 1.0,
      descriptionTag: 'nightlife',
    },
  },
  {
    slug: 'docklands',
    name: 'Docklands',
    description:
      'Container yards and freight cranes. Hard crews and dockside muscle — thugs find their place here.',
    modifiers: {
      prostituteRecruitment: 1.0,
      thugRecruitment: 1.12,
      resultConsistency: 1.0,
      descriptionTag: 'industrial',
    },
  },
  {
    slug: 'old-quarter',
    name: 'Old Quarter',
    description:
      'Established networks beneath cobblestone alleys. Outcomes tend toward the predictable — old money, old loyalties.',
    modifiers: {
      prostituteRecruitment: 1.04,
      thugRecruitment: 1.04,
      resultConsistency: 1.08,
      descriptionTag: 'established',
    },
  },
];
