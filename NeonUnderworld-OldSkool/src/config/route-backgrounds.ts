import type { GameBackgroundKey } from './backgrounds';

const ROUTE_BACKGROUNDS: Array<[string, GameBackgroundKey]> = [
  ['/command', 'home'],
  ['/empire', 'empire'],
  ['/scout', 'scout'],
  ['/produce', 'produce'],
  ['/shop', 'shop'],
  ['/rankings', 'rankings'],
  ['/attack', 'attack'],
  ['/travel', 'travel'],
  ['/market', 'market'],
  ['/cartels', 'cartel'],
  ['/reports', 'reports'],
  ['/guides', 'guides'],
  ['/how-to-play', 'guides'],
  ['/businesses', 'empire'],
  ['/players', 'intel'],
];

export function getBackgroundForPath(pathname: string): GameBackgroundKey | undefined {
  for (const [prefix, key] of ROUTE_BACKGROUNDS) {
    if (pathname === prefix || pathname.startsWith(`${prefix}/`)) {
      return key;
    }
  }
  return undefined;
}
