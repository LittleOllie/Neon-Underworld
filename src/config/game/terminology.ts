/**
 * Central terminology module — swap player-facing labels globally without changing game logic.
 * Internal DB/API keys (prostitutes, thugs, hash, Cartel, DRIVE_BY, etc.) stay unchanged.
 */
export const TERMS = {
  /** Player identity */
  operator: 'Operator',
  player: 'Operator',
  alias: 'Alias',

  /** Organisation */
  cartel: 'Faction',
  cartels: 'Factions',
  faction: 'Faction',
  factions: 'Factions',

  /** Crew / personnel (maps legacy config keys → display) */
  crew: 'Crew',
  personnel: 'Crew',
  prostitutes: 'Specialists',
  worker: 'Specialist',
  workers: 'Specialists',
  specialist: 'Specialist',
  specialists: 'Specialists',
  thugs: 'Enforcers',
  thug: 'Enforcer',
  enforcer: 'Enforcer',
  enforcers: 'Enforcers',

  /** Economy */
  cash: 'Cash',
  netWorth: 'Influence',
  influence: 'Influence',
  rank: 'Rank',
  bank: 'Bank',

  /** Technology resources (internal keys → display) */
  hash: 'Components',
  shrooms: 'Chips',
  coke: 'Modules',
  heroin: 'Cores',
  drugs: 'Technology',
  technology: 'Technology',

  /** Supplies */
  condoms: 'Kits',
  kit: 'Kit',
  kits: 'Kits',
  beer: 'Rations',
  ration: 'Ration',
  rations: 'Rations',

  /** Weapons & transport */
  glock: 'Sidearm',
  glocks: 'Sidearms',
  uzi: 'SMG',
  uzis: 'SMGs',
  ak: 'Assault Rifle',
  aks: 'Assault Rifles',
  ride: 'Ride',
  rides: 'Rides',
  weapons: 'Weapons',
  vehicles: 'Vehicles',

  /** Systems & navigation */
  turns: 'Turns',
  scout: 'Scout',
  command: 'Command',
  empire: 'Empire',
  market: 'Market',
  operations: 'Operations',
  shop: 'Shop',
  travel: 'Travel',
  district: 'District',
  rankings: 'Rankings',
  intel: 'Intel',
  deepIntel: 'Deep Intel',
  wire: 'The Wire',
  reports: 'Reports',
  attack: 'Attack',
  businesses: 'Businesses',

  /** Business types (maps BusinessType enum → display) */
  warehouse: 'Depot',
  nightclub: 'Club',
  drugLab: 'Workshop',

  /** Business risk */
  heat: 'Trace',
  securitySweep: 'Security Sweep',

  /** Legacy Redlite labels — not active mechanics; kept for reference mappers */
  brothels: 'Brothels',
  coffeeShops: 'Coffee Shops',
} as const;

export type TermKey = keyof typeof TERMS;

export function term(key: TermKey): string {
  return TERMS[key];
}

/** Technology resource keys — stable internal IDs with player-facing labels. */
export const RESOURCE_DISPLAY_NAMES = {
  hash: TERMS.hash,
  shrooms: TERMS.shrooms,
  coke: TERMS.coke,
  heroin: TERMS.heroin,
} as const;

export type ResourceDisplayKey = keyof typeof RESOURCE_DISPLAY_NAMES;

export function resourceLabel(key: ResourceDisplayKey): string {
  return RESOURCE_DISPLAY_NAMES[key];
}

/** Navigation labels */
export const NAV = {
  command: TERMS.command,
  empire: TERMS.empire,
  market: TERMS.market,
  operations: TERMS.operations,
  cartel: TERMS.faction,
} as const;
