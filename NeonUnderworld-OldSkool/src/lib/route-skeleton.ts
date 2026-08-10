/** Skeleton layout variants matched to destination page structure. */
export type RouteSkeletonVariant =
  | 'home'
  | 'empire'
  | 'action'
  | 'shop'
  | 'list'
  | 'profile'
  | 'default';

export function getRouteSkeletonVariant(pathname: string): RouteSkeletonVariant {
  const base = pathname.split('?')[0] ?? pathname;

  if (base === '/command') return 'home';
  if (base === '/empire') return 'empire';
  if (base === '/shop') return 'shop';
  if (['/scout', '/produce', '/attack', '/travel'].includes(base)) return 'action';
  if (
    ['/rankings', '/reports', '/market', '/cartels', '/guides', '/how-to-play'].includes(base) ||
    base.startsWith('/reports/')
  ) {
    return 'list';
  }
  if (base.startsWith('/players/')) return 'profile';
  return 'default';
}
