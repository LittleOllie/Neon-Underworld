/**
 * Neon Underworld Phase 3 artwork — isolated from legacy game-backgrounds/.
 *
 * Drop page files into public/images/nu/backgrounds/
 * Register only keys whose files exist (do not map missing assets).
 */

export const NU_BACKGROUND_DIR = '/images/nu/backgrounds';
export const NU_BRAND_DIR = '/images/nu/brand';

/** Registered NU page backgrounds — add keys when artwork ships. */
export type NuBackgroundKey = 'intro' | 'command' | 'empire' | 'scout' | 'operations' | 'shop' | 'market' | 'attack' | 'intel' | 'reports' | 'factions' | 'businesses' | 'travel' | 'rankings' | 'guides' | 'settings' | 'identity';

export interface NuBackgroundSpec {
  /** Filename inside NU_BACKGROUND_DIR */
  file: string;
  /** Desktop / default object-position */
  position: string;
  /** Optional mobile override — omit to use `position` */
  mobilePosition?: string;
  /** Overlay strength 0–1 (higher = more UI contrast, less visible art) */
  overlayStrength: number;
  /** Cache-bust when replacing the file */
  revision: number;
  /** Composite master Operator over environment (never on intro) */
  showOperator?: boolean;
}

export const NU_BACKGROUNDS: Record<NuBackgroundKey, NuBackgroundSpec> = {
  intro: {
    file: 'intro.webp',
    /** Hooded silhouette — desktop pans right; portrait crop needs less pan. */
    position: '47% center',
    mobilePosition: '51% center',
    overlayStrength: 0.32,
    revision: 2,
  },
  command: {
    file: 'command.webp',
    position: 'center center',
    overlayStrength: 0.18,
    revision: 3,
  },
  empire: {
    file: 'empire.webp',
    position: 'center center',
    overlayStrength: 0.18,
    revision: 3,
  },
  scout: {
    file: 'scout.webp',
    position: 'center center',
    overlayStrength: 0.18,
    revision: 2,
  },
  operations: {
    file: 'operations.webp',
    position: 'center center',
    overlayStrength: 0.18,
    revision: 2,
  },
  shop: {
    file: 'shop.webp',
    position: 'center center',
    overlayStrength: 0.18,
    revision: 2,
  },
  market: {
    file: 'market.webp',
    position: 'center center',
    overlayStrength: 0.18,
    revision: 2,
  },
  attack: {
    file: 'attack.webp',
    position: 'center center',
    overlayStrength: 0.18,
    revision: 2,
  },
  intel: {
    file: 'intel.webp',
    position: 'center center',
    overlayStrength: 0.18,
    revision: 2,
  },
  reports: {
    file: 'reports.webp',
    position: 'center center',
    overlayStrength: 0.18,
    revision: 2,
  },
  factions: {
    file: 'factions.webp',
    position: 'center center',
    overlayStrength: 0.18,
    revision: 2,
  },
  businesses: {
    file: 'businesses.webp',
    position: 'center center',
    overlayStrength: 0.18,
    revision: 2,
  },
  travel: {
    file: 'travel.webp',
    position: 'center center',
    overlayStrength: 0.18,
    revision: 2,
  },
  rankings: {
    file: 'rankings.webp',
    position: 'center center',
    overlayStrength: 0.18,
    revision: 2,
  },
  guides: {
    file: 'guides.webp',
    position: 'center center',
    overlayStrength: 0.18,
    revision: 2,
  },
  settings: {
    file: 'settings.webp',
    position: 'center center',
    overlayStrength: 0.18,
    revision: 2,
  },
  identity: {
    file: 'identity.webp',
    position: 'center center',
    overlayStrength: 0.46,
    revision: 1,
  },
};

export function nuBackgroundSpec(key: NuBackgroundKey): NuBackgroundSpec {
  return NU_BACKGROUNDS[key];
}

export function nuBackgroundSrc(key: NuBackgroundKey): string {
  const spec = NU_BACKGROUNDS[key];
  return `${NU_BACKGROUND_DIR}/${spec.file}`;
}

export function nuBackgroundUrl(key: NuBackgroundKey): string {
  const spec = NU_BACKGROUNDS[key];
  return `${nuBackgroundSrc(key)}?v=${spec.revision}`;
}

export function nuBackgroundPosition(key: NuBackgroundKey, mobile = false): string {
  const spec = NU_BACKGROUNDS[key];
  if (mobile && spec.mobilePosition) return spec.mobilePosition;
  return spec.position;
}

/** Resolve whether the master Operator layer should appear for a page background. */
export function nuBackgroundShowsOperator(
  key: NuBackgroundKey,
  override?: boolean,
): boolean {
  const spec = NU_BACKGROUNDS[key];
  if (key === 'intro') return false;
  if (override !== undefined) return override;
  return spec.showOperator ?? false;
}
