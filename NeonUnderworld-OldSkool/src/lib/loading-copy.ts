/** Route-level loading labels — shown only when navigation actually suspends. */
const ROUTE_LOADING: Record<string, string> = {
  '/command': 'Opening Command…',
  '/empire': 'Loading Empire…',
  '/scout': 'Opening Scout Network…',
  '/produce': 'Opening Production…',
  '/shop': 'Opening Shop…',
  '/rankings': 'Loading Rankings…',
  '/attack': 'Loading Targeting…',
  '/travel': 'Opening Travel Network…',
  '/market': 'Opening Market…',
  '/cartels': 'Loading Cartel Network…',
  '/reports': 'Retrieving Reports…',
  '/guides': 'Loading Guides…',
  '/how-to-play': 'Loading Guide…',
};

export function routeLoadingMessage(pathname: string): string {
  const base = pathname.split('?')[0] ?? pathname;
  if (ROUTE_LOADING[base]) return ROUTE_LOADING[base];
  if (base.startsWith('/reports/')) return 'Opening Report…';
  if (base.startsWith('/players/')) return 'Loading Profile…';
  return 'Loading…';
}

/** Gameplay action pending copy — shown while server actions resolve. */
export const ACTION_PENDING = {
  scout: 'Working the streets…',
  produce: 'Running production…',
  attack: 'Making the move…',
  shopPurchase: 'Completing purchase…',
  marketBid: 'Locking in your bid…',
  marketList: 'Listing on the Market…',
  cartelInvite: 'Sending invite…',
  cartelJoin: 'Joining cartel…',
  cartelCreate: 'Creating cartel…',
  homeShopSell: 'Completing sale…',
  travel: (destination: string) => `En route to ${destination}…`,
} as const;
