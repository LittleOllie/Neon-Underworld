/**
 * Navigation transition UX — logo, timing thresholds, and route messages.
 *
 * To swap the loading logo later, change NAVIGATION_LOADER_LOGO only.
 */

/** Single source for the NU logo used during in-app navigation transitions. */
export const NAVIGATION_LOADER_LOGO = '/images/game-backgrounds/NUPFPLogo.webp';

export const NAVIGATION_TRANSITION_THRESHOLDS = {
  /** Fast navigation — show nothing (ms). */
  subtleMs: 175,
  /** Escalate to full network overlay with logo + message (ms). */
  fullMs: 700,
  /** Failsafe — clear overlay if navigation stalls (ms). */
  timeoutMs: 10_000,
  /** Top progress bar complete flash (ms). */
  progressCompleteMs: 220,
} as const;

/** Uppercase network messages shown during slow navigation (700ms+). */
const NAVIGATION_ROUTE_MESSAGES: Record<string, string> = {
  '/command': 'CONNECTING TO NETWORK...',
  '/empire': 'LOADING YOUR EMPIRE...',
  '/scout': 'SCANNING THE STREETS...',
  '/produce': 'OPENING THE LAB...',
  '/shop': 'CONTACTING SUPPLIERS...',
  '/attack': 'LOCATING TARGETS...',
  '/market': 'CONNECTING TO MARKET...',
  '/cartels': 'OPENING CARTEL NETWORK...',
  '/businesses': 'LOADING OPERATIONS...',
  '/rankings': 'CHECKING THE NETWORK...',
  '/reports': 'DECRYPTING REPORTS...',
  '/travel': 'MAPPING ROUTE...',
  '/bank': 'ACCESSING ACCOUNTS...',
  '/settings': 'ACCESSING SETTINGS...',
  '/how-to-play': 'ACCESSING NETWORK FILES...',
  '/guides': 'ACCESSING NETWORK FILES...',
};

const NAVIGATION_FALLBACK_MESSAGE = 'CONNECTING TO NETWORK...';

export function navigationRouteMessage(pathname: string): string {
  const base = pathname.split('?')[0] ?? pathname;
  if (NAVIGATION_ROUTE_MESSAGES[base]) return NAVIGATION_ROUTE_MESSAGES[base];
  if (base.startsWith('/reports/')) return 'DECRYPTING REPORT...';
  if (base.startsWith('/players/')) return 'LOCATING PLAYER...';
  return NAVIGATION_FALLBACK_MESSAGE;
}

/** Softer copy for route Suspense skeleton strip (same routes, readable casing). */
export function routeSuspenseLoadingMessage(pathname: string): string {
  const network = navigationRouteMessage(pathname);
  if (network.endsWith('...')) {
    const words = network.slice(0, -3).toLowerCase();
    return `${words.charAt(0).toUpperCase()}${words.slice(1)}…`;
  }
  return network;
}
