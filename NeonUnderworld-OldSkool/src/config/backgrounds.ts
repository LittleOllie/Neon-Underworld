/**
 * Page background artwork — drop files into public/images/game-backgrounds/
 *
 * Filenames: {key}.webp (e.g. home.webp, scout.webp)
 * Missing files fall back silently to the default dark background.
 */

export type GameBackgroundKey =
  | 'home'
  | 'empire'
  | 'scout'
  | 'produce'
  | 'shop'
  | 'rankings'
  | 'intel'
  | 'attack'
  | 'reports'
  | 'guides'
  /** Reserved — wire to Market page when feature ships (`/coming/market` or `/market`) */
  | 'market'
  /** Reserved — wire to Travel page when feature ships (`/coming/travel` or `/travel`) */
  | 'travel'
  /** Reserved — wire to Cartel page when feature ships (`/coming/cartel` or `/cartel`) */
  | 'cartel';

export const GAME_BACKGROUND_DIR = '/images/game-backgrounds';

/** When filename differs from key (e.g. market → markets.png) */
export const GAME_BACKGROUND_FILENAME: Partial<Record<GameBackgroundKey, string>> = {
  market: 'markets',
};

export function gameBackgroundFileStem(key: GameBackgroundKey): string {
  return GAME_BACKGROUND_FILENAME[key] ?? key;
}

/** Legacy *screen.png names in game-backgrounds/ — tried after standard webp/png 404 */
export const GAME_BACKGROUND_LEGACY_NAMES: Partial<Record<GameBackgroundKey, string>> = {
  home: 'homescreen',
  empire: 'empirescreen',
  scout: 'scoutscreen',
  shop: 'shopscreen',
  produce: 'producescreen',
};

export function gameBackgroundLegacySrc(key: GameBackgroundKey): string | null {
  const legacy = GAME_BACKGROUND_LEGACY_NAMES[key];
  return legacy ? `${GAME_BACKGROUND_DIR}/${legacy}.png` : null;
}

/**
 * Bump a page when you replace its image file — busts browser cache for that background only.
 * home: 4 — replaced home.png from home1.png (Aug 2026)
 * intel: 2 — replaced intel.png (Aug 2026)
 * attack: 2 — replaced attack.png (Aug 2026)
 * reports: 2 — replaced reports.png (Aug 2026)
 * guides: 2 — replaced guides.png (Aug 2026)
 */
export const GAME_BACKGROUND_REVISION: Partial<Record<GameBackgroundKey, number>> = {
  home: 4,
  intel: 2,
  attack: 2,
  reports: 2,
  guides: 2,
};

export function gameBackgroundUrl(path: string, key: GameBackgroundKey): string {
  const rev = GAME_BACKGROUND_REVISION[key] ?? 1;
  return `${path}?v=${rev}`;
}

/** Artwork opacity before overlay (subtle — UI always wins) */
export const GAME_BACKGROUND_ART_OPACITY = 0.13;

/** Optional per-page object-position override (default: center center) */
export const GAME_BACKGROUND_POSITION: Partial<Record<GameBackgroundKey, string>> = {
  home: 'center top',
  empire: 'center center',
  scout: 'center center',
  produce: 'center center',
  shop: 'center center',
  rankings: 'center center',
  intel: 'center center',
  attack: 'center center',
  reports: 'center center',
  guides: 'center center',
  market: 'center center',
  travel: 'center center',
  cartel: 'center center',
};

export function gameBackgroundSrc(key: GameBackgroundKey): string {
  return `${GAME_BACKGROUND_DIR}/${gameBackgroundFileStem(key)}.webp`;
}

export function gameBackgroundSrcPng(key: GameBackgroundKey): string {
  return `${GAME_BACKGROUND_DIR}/${gameBackgroundFileStem(key)}.png`;
}

export function gameBackgroundPosition(key: GameBackgroundKey): string {
  return GAME_BACKGROUND_POSITION[key] ?? 'center center';
}

/** Optional per-page zoom (1 = default cover fit) */
export const GAME_BACKGROUND_SCALE: Partial<Record<GameBackgroundKey, number>> = {
  home: 1.9,
};

export function gameBackgroundScale(key: GameBackgroundKey): number {
  return GAME_BACKGROUND_SCALE[key] ?? 1;
}

/** Optional vertical shift after scale (negative = lift image up) */
export const GAME_BACKGROUND_OFFSET_Y: Partial<Record<GameBackgroundKey, string>> = {
  home: '-55%',
};

export function gameBackgroundOffsetY(key: GameBackgroundKey): string | null {
  return GAME_BACKGROUND_OFFSET_Y[key] ?? null;
}

/** Optional per-page overlay boost (0 = global default; e.g. 0.15 for brighter art) */
export const GAME_BACKGROUND_DARKNESS: Partial<Record<GameBackgroundKey, number>> = {};

export function gameBackgroundDarkness(key: GameBackgroundKey): number {
  return GAME_BACKGROUND_DARKNESS[key] ?? 0;
}
