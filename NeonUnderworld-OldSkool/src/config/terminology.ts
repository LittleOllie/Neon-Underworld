/**
 * OldSkool player-facing terminology — single display layer.
 * Internal DB fields (prostitutes, district) are unchanged.
 */
export const OS_TERMS = {
  worker: 'Worker',
  workers: 'Workers',
  thug: 'Thug',
  thugs: 'Thugs',
  city: 'City',
  player: 'Player',
  alias: 'Alias',
  netWorth: 'Net Worth',
  cash: 'Cash',
  bankCash: 'Bank',
  turns: 'Turns',
  rank: 'Rank',
  districtRank: 'District Rank',
  cartel: 'Cartel',
  scout: 'Scout',
  report: 'Report',
  reports: 'Reports',
  online: 'Online',
  lastSeen: 'Last Seen',
  weapons: 'Weapons',
  vehicles: 'Vehicles',
  drugs: 'Drugs',
  businesses: 'Businesses',
  personnel: 'Personnel',
  financial: 'Financial',
  inventory: 'Inventory',
  glocks: 'Glocks',
  uzis: 'Uzis',
  aks: 'AKs',
  hash: 'Hash',
  shrooms: 'Shrooms',
  coke: 'Coke',
  heroin: 'Heroin',
  beer: 'Beer',
  condoms: 'Condoms',
  rides: 'Rides',
} as const;

export function workersLabel(count: number): string {
  return count === 1 ? OS_TERMS.worker : OS_TERMS.workers;
}

export function thugsLabel(count: number): string {
  return count === 1 ? OS_TERMS.thug : OS_TERMS.thugs;
}
