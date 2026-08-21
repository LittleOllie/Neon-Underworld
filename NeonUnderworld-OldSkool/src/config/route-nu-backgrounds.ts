import type { NuBackgroundKey } from '@local/config/nu-backgrounds';

/** Gameplay routes using Phase 3 NU scene stack (environment + optional Operator). */
const ROUTE_NU_BACKGROUNDS: Array<[string, NuBackgroundKey]> = [
  ['/command', 'command'],
  ['/empire', 'empire'],
  ['/scout', 'scout'],
  ['/produce', 'operations'],
  ['/shop', 'shop'],
  ['/market', 'market'],
  ['/attack', 'attack'],
  ['/reports', 'reports'],
  ['/cartels', 'factions'],
  ['/businesses', 'businesses'],
  ['/travel', 'travel'],
  ['/rankings', 'rankings'],
  ['/players', 'intel'],
  ['/how-to-play', 'guides'],
  ['/guides', 'guides'],
  ['/settings', 'settings'],
  ['/identity', 'identity'],
];

export function getNuBackgroundForPath(pathname: string): NuBackgroundKey | undefined {
  for (const [prefix, key] of ROUTE_NU_BACKGROUNDS) {
    if (pathname === prefix || pathname.startsWith(`${prefix}/`)) {
      return key;
    }
  }
  return undefined;
}
