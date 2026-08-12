/**
 * Redlite Distrikt Amsterdam Edition — canonical rule constants.
 * Source: docs/reference/REDLITE_AMSTERDAM_GUIDES.md
 *
 * Neon Underworld keeps deliberate improvements where noted (bank NW, weighted weapons, reports).
 */

/** 2 turns every 5 minutes (alpha — slightly faster than classic Redlite 6 min) */
export const REDLITE_TURNS = {
  turnsPerInterval: 2,
  intervalMinutes: 5,
  /** ~24 turns/hour, ~576/day */
  regenerationRatePerHour: 24,
  regenerationRatePerMs: 2 / (5 * 60 * 1000),
  /** Alpha playtest — friends start with a full turn bank to explore */
  startingTurns: 5000,
  turnCap: 5000,
  travelTurnCost: 10,
} as const;

/** Asset values included in net worth rankings */
export const REDLITE_NET_WORTH = {
  prostitutes: 1750,
  thugs: 700,
  rides: 2000,
  hash: 5,
  shrooms: 5,
  coke: 5,
  heroin: 5,
  cash: 1,
  /** Brothels and coffee shops do NOT add to net worth (Redlite guide §5) */
  excludesFromNetWorth: ['weapons', 'beer', 'condoms', 'brothels', 'coffeeShops'] as const,
} as const;

/** Distrikt Market starting prices (guide §4) */
export const REDLITE_MARKET_STARTING_PRICES = {
  whore: 1750,
  thug: 700,
  ride: 2000,
  ak: 3240,
  uzi: 1200,
  glock: 400,
  hash: 1,
  shroom: 5,
  coke: 9,
  heroin: 13,
  brothel: 5000,
  coffeeShop: 5000,
  beer: 2,
  condom: 1,
} as const;

export const REDLITE_MARKET = {
  bidIncrementPercent: 20,
  /** Cannot sell brothels or coffee shops on market */
  unsellableAssets: ['brothel', 'coffeeShop'] as const,
} as const;

/** Five scout areas per city (guide §2) */
export const REDLITE_SCOUT_AREAS = [
  {
    slug: 'streets',
    name: 'The Streets',
    description: 'Street-level recruitment — favours workers.',
    prostituteRecruitment: 1.18,
    thugRecruitment: 0.92,
    resultConsistency: 1.0,
  },
  {
    slug: 'clubs',
    name: 'Night Clubs',
    description: 'Velvet rope crowds — highest worker yield.',
    prostituteRecruitment: 1.28,
    thugRecruitment: 0.85,
    resultConsistency: 0.95,
  },
  {
    slug: 'docks',
    name: 'The Docks',
    description: 'Hard crews on the waterfront — favours thugs.',
    prostituteRecruitment: 0.88,
    thugRecruitment: 1.25,
    resultConsistency: 1.0,
  },
  {
    slug: 'alleys',
    name: 'Back Alleys',
    description: 'Balanced muscle and talent from the shadows.',
    prostituteRecruitment: 1.05,
    thugRecruitment: 1.08,
    resultConsistency: 1.05,
  },
  {
    slug: 'markets',
    name: 'Underground Markets',
    description: 'Volatile but consistent contacts.',
    prostituteRecruitment: 1.0,
    thugRecruitment: 1.0,
    resultConsistency: 1.12,
  },
] as const;

export type RedliteScoutAreaSlug = (typeof REDLITE_SCOUT_AREAS)[number]['slug'];

export function getScoutArea(slug: string) {
  return REDLITE_SCOUT_AREAS.find((a) => a.slug === slug) ?? REDLITE_SCOUT_AREAS[0];
}

/** Worker payout — Redlite: ~1% for max profit, 100% to protect whores when idle */
export const REDLITE_PAYOUT = {
  minPercent: 1,
  maxPercent: 100,
  profitOptimalPercent: 1,
  protectionPercent: 100,
} as const;

/** Thug weapons — firing capacity (guide §7) */
export const REDLITE_WEAPONS = {
  glock: { name: 'Glock', combatCapacity: 2, shopPrice: REDLITE_MARKET_STARTING_PRICES.glock },
  uzi: { name: 'Uzi', combatCapacity: 25, shopPrice: REDLITE_MARKET_STARTING_PRICES.uzi },
  ak: { name: 'AK', combatCapacity: 45, shopPrice: REDLITE_MARKET_STARTING_PRICES.ak },
  gunsPerThug: 1,
} as const;

/** 1 ride per 5 thugs on attacks / brothel invasions (guide §7, §9) */
export const REDLITE_VEHICLES = {
  thugsPerRide: 5,
  rideValue: 2000,
} as const;

/** Attack net worth floor: targets must be at least half the attacker's net worth. No upper cap. */
export const ATTACK_MIN_TARGET_NET_WORTH_RATIO = 0.5;

export const REDLITE_ATTACK = {
  minNetWorthMultiplier: ATTACK_MIN_TARGET_NET_WORTH_RATIO,
} as const;

export function minAttackTargetNetWorth(attackerNetWorth: number): number {
  if (attackerNetWorth <= 0) return 0;
  return Math.ceil(attackerNetWorth * ATTACK_MIN_TARGET_NET_WORTH_RATIO);
}

export function isWithinAttackRange(
  attackerNetWorth: number,
  targetNetWorth: number,
): boolean {
  if (attackerNetWorth <= 0) return false;
  return targetNetWorth >= minAttackTargetNetWorth(attackerNetWorth);
}

/** Cartels (guide §6) */
export const REDLITE_CARTEL = {
  maxMembers: 5,
  maxDonationPercent: 60,
  drugDonationCooldownHours: 12,
  maxDrugDonationsPerWindow: 2,
} as const;

/** Travel (guide §8) */
export const REDLITE_TRAVEL = {
  turnCost: 10,
  /** Crew (thugs + workers) per ride when relocating */
  crewPerRide: REDLITE_VEHICLES.thugsPerRide,
  minRidesRequired: 1,
  travelsPerRoundMember: 90,
  travelsPerRoundNonMember: 20,
  thugTrainCost: 200,
  whoreTrainCost: 30,
  coffeeShopMoveCost: 3000,
  brothelMoveCost: 5000,
  thugsInRidesFree: true,
} as const;

/** Brothels (guide §9) */
export const REDLITE_BROTHEL_TYPES = [
  { type: 1, label: 'T-1', capacity: 50, maxRate: 50 },
  { type: 2, label: 'T-2', capacity: 100, maxRate: 125 },
  { type: 3, label: 'T-3', capacity: 200, maxRate: 250 },
  { type: 4, label: 'T-4', capacity: 400, maxRate: 325 },
  { type: 5, label: 'T-5', capacity: 800, maxRate: 500 },
] as const;

export const REDLITE_BROTHEL = {
  collectTurnCost: 1,
  marketStartPrice: 5000,
} as const;

/** Coffee shops (guide §10) */
export const REDLITE_COFFEE_SHOP_TYPES = [
  { drug: 'hash', label: 'Hash Coffee Shop', maxSellPrice: 30 },
  { drug: 'shrooms', label: 'Shroom Coffee Shop', maxSellPrice: 75 },
  { drug: 'coke', label: 'Coke Coffee Shop', maxSellPrice: 95 },
  { drug: 'heroin', label: 'Heroin Coffee Shop', maxSellPrice: 110 },
] as const;

export const REDLITE_COFFEE_SHOP = {
  collectTurnCost: 1,
  marketStartPrice: 5000,
} as const;

/** Make drugs — output scales with thugs + turns (guide §2) */
export const REDLITE_PRODUCTION = {
  baseDrugUnitsPerTurnPerThug: 0.012,
  maxDrugUnitsPerAction: 2000,
  defaultDrug: 'hash' as const,
  /** Workers earn cash while you use turns (scout + produce) */
  cashPerProstitutePerTurn: 12,
} as const;
