/**
 * Central terminology module — swap labels globally without changing game logic.
 */
export const TERMS = {
  prostitutes: 'Prostitutes',
  thugs: 'Thugs',
  rides: 'Rides',
  brothels: 'Brothels',
  coffeeShops: 'Coffee Shops',
  cartel: 'Cartel',
  hash: 'Hash',
  shrooms: 'Shrooms',
  coke: 'Coke',
  heroin: 'Heroin',
  glocks: 'Glocks',
  uzis: 'Uzis',
  aks: 'AKs',
  beer: 'Beer',
  condoms: 'Condoms',
  cash: 'Cash',
  turns: 'Turns',
  netWorth: 'Net Worth',
  rank: 'Rank',
  scout: 'Scout',
  command: 'Command',
  empire: 'Empire',
  market: 'Market',
  operations: 'Operations',
} as const;

export type TermKey = keyof typeof TERMS;

export function term(key: TermKey): string {
  return TERMS[key];
}

/** Navigation labels */
export const NAV = {
  command: TERMS.command,
  empire: TERMS.empire,
  market: TERMS.market,
  operations: TERMS.operations,
  cartel: TERMS.cartel,
} as const;
