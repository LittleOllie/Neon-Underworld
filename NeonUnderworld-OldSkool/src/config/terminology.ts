/**
 * OldSkool player-facing terminology — single display layer.
 * Internal DB fields (prostitutes, thugs, hash, cartelId, etc.) are unchanged.
 */
import {
  RESOURCE_DISPLAY_NAMES,
  TERMS as CORE_TERMS,
  type ResourceDisplayKey,
} from '@core/config/game/terminology';

export const OS_TERMS = {
  operator: CORE_TERMS.operator,
  player: CORE_TERMS.player,
  alias: CORE_TERMS.alias,

  crew: CORE_TERMS.crew,
  personnel: CORE_TERMS.personnel,
  /** @deprecated Prefer specialist/specialists — kept for existing imports */
  worker: CORE_TERMS.specialist,
  workers: CORE_TERMS.specialists,
  specialist: CORE_TERMS.specialist,
  specialists: CORE_TERMS.specialists,
  /** @deprecated Prefer enforcer/enforcers — kept for existing imports */
  thug: CORE_TERMS.enforcer,
  thugs: CORE_TERMS.enforcers,
  enforcer: CORE_TERMS.enforcer,
  enforcers: CORE_TERMS.enforcers,

  city: 'City',
  netWorth: CORE_TERMS.influence,
  influence: CORE_TERMS.influence,
  cash: CORE_TERMS.cash,
  bankCash: CORE_TERMS.bank,
  turns: CORE_TERMS.turns,
  rank: CORE_TERMS.rank,
  districtRank: 'District Rank',

  cartel: CORE_TERMS.faction,
  factions: CORE_TERMS.factions,
  faction: CORE_TERMS.faction,

  scout: CORE_TERMS.scout,
  shop: CORE_TERMS.shop,
  market: CORE_TERMS.market,
  travel: CORE_TERMS.travel,
  district: CORE_TERMS.district,
  rankings: CORE_TERMS.rankings,
  intel: CORE_TERMS.intel,
  deepIntel: CORE_TERMS.deepIntel,
  wire: CORE_TERMS.wire,
  attack: CORE_TERMS.attack,
  empire: CORE_TERMS.empire,
  businesses: CORE_TERMS.businesses,

  report: 'Report',
  reports: CORE_TERMS.reports,
  online: 'Online',
  lastSeen: 'Last Seen',

  weapons: CORE_TERMS.weapons,
  vehicles: CORE_TERMS.vehicles,
  drugs: CORE_TERMS.technology,
  technology: CORE_TERMS.technology,
  inventory: 'Inventory',
  financial: 'Financial',

  glock: CORE_TERMS.glock,
  glocks: CORE_TERMS.glocks,
  uzi: CORE_TERMS.uzi,
  uzis: CORE_TERMS.uzis,
  ak: CORE_TERMS.ak,
  aks: CORE_TERMS.aks,
  hash: CORE_TERMS.hash,
  shrooms: CORE_TERMS.shrooms,
  coke: CORE_TERMS.coke,
  heroin: CORE_TERMS.heroin,
  condoms: CORE_TERMS.kits,
  kit: CORE_TERMS.kit,
  kits: CORE_TERMS.kits,
  beer: CORE_TERMS.rations,
  ration: CORE_TERMS.ration,
  rations: CORE_TERMS.rations,
  rides: CORE_TERMS.rides,
  ride: CORE_TERMS.ride,

  warehouse: CORE_TERMS.warehouse,
  nightclub: CORE_TERMS.nightclub,
  drugLab: CORE_TERMS.drugLab,
  heat: CORE_TERMS.heat,
  securitySweep: CORE_TERMS.securitySweep,
} as const;

export type { ResourceDisplayKey };

export function resourceLabel(key: ResourceDisplayKey): string {
  return RESOURCE_DISPLAY_NAMES[key];
}

/** @deprecated Use specialistsLabel */
export function workersLabel(count: number): string {
  return count === 1 ? OS_TERMS.specialist : OS_TERMS.specialists;
}

/** @deprecated Use enforcersLabel */
export function thugsLabel(count: number): string {
  return count === 1 ? OS_TERMS.enforcer : OS_TERMS.enforcers;
}

export function specialistsLabel(count: number): string {
  return workersLabel(count);
}

export function enforcersLabel(count: number): string {
  return thugsLabel(count);
}
