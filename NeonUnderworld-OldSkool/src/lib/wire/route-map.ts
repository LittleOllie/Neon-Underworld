import { DESKTOP_NAV, buildMoreMenuSections } from '@local/config/navigation';

const ROUTE_ALIASES: Record<string, string> = {
  home: '/command',
  command: '/command',
  headquarters: '/command',
  hq: '/command',
  empire: '/empire',
  shop: '/shop',
  store: '/shop',
  scout: '/scout',
  scouting: '/scout',
  produce: '/produce',
  production: '/produce',
  travel: '/travel',
  attack: '/attack',
  market: '/market',
  businesses: '/businesses',
  business: '/businesses',
  cartels: '/cartels',
  cartel: '/cartels',
  rankings: '/rankings',
  ranking: '/rankings',
  ranks: '/rankings',
  leaderboard: '/rankings',
  reports: '/reports',
  report: '/reports',
  inbox: '/reports',
  settings: '/settings',
  setting: '/settings',
  preferences: '/settings',
  'how to play': '/how-to-play',
  guides: '/how-to-play',
};

function normalizeRoutePhrase(phrase: string): string {
  return phrase.trim().toLowerCase().replace(/\s+/g, ' ');
}

function collectRoutesFromNavigation(): Map<string, string> {
  const map = new Map<string, string>();

  const register = (label: string, href: string) => {
    if (!href || href.startsWith('#') || href.startsWith('http')) return;
    map.set(normalizeRoutePhrase(label), href);
  };

  for (const item of DESKTOP_NAV) {
    if (!item.isMore) register(item.label, item.href);
  }

  for (const section of buildMoreMenuSections()) {
    for (const item of section.items) {
      if (item.action === 'logout') continue;
      register(item.label, item.href);
    }
  }

  for (const [alias, href] of Object.entries(ROUTE_ALIASES)) {
    map.set(normalizeRoutePhrase(alias), href);
  }

  return map;
}

export const WIRE_ROUTE_MAP = collectRoutesFromNavigation();

const NAV_PREFIX =
  /^(?:open|go to|take me to|show me|show|navigate to|visit|view|switch to)\s+/;

export function stripNavigationPrefix(normalized: string): string {
  return normalized.replace(NAV_PREFIX, '').trim();
}

export function resolveWireRoute(phrase: string): string | null {
  const key = normalizeRoutePhrase(stripNavigationPrefix(phrase));
  if (!key) return null;
  return WIRE_ROUTE_MAP.get(key) ?? null;
}

export function listSupportedRoutePhrases(): string[] {
  return [...WIRE_ROUTE_MAP.keys()].sort();
}
