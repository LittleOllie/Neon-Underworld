import type { BootSessionStatus } from '@local/config/boot-screen';

/** NextAuth client session status — loading must never be treated as logged out. */
export type ClientSessionStatus = 'loading' | 'authenticated' | 'unauthenticated';

/**
 * Routes middleware protects — if the player reached one, a valid server session
 * already passed. Client-side unauthenticated must not be treated as logout here.
 */
export const BOOT_PROTECTED_GAME_ROUTE_PREFIXES = [
  '/command',
  '/empire',
  '/operations',
  '/underworld',
  '/social',
  '/scout',
  '/produce',
  '/shop',
  '/bank',
  '/attack',
  '/travel',
  '/market',
  '/businesses',
  '/cartels',
  '/reports',
  '/rankings',
  '/players',
  '/identity',
  '/settings',
  '/guides',
  '/how-to-play',
  '/coming',
  '/playtest',
] as const;

export function isProtectedGameRoute(pathname: string): boolean {
  return BOOT_PROTECTED_GAME_ROUTE_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

/**
 * Map NextAuth client status to boot copy state.
 * Loading never becomes unauthenticated; protected routes keep waiting on client lag.
 */
export function resolveBootSessionStatus(
  sessionStatus: ClientSessionStatus,
  pathname: string,
): BootSessionStatus {
  if (sessionStatus === 'loading') return 'loading';
  if (sessionStatus === 'authenticated') return 'authenticated';
  if (isProtectedGameRoute(pathname)) return 'loading';
  return 'unauthenticated';
}

/**
 * Post-boot navigation target.
 * Returns null while auth is unresolved (loading) — caller must not redirect.
 */
export function resolveBootDismissTarget(
  pathname: string,
  bootStatus: BootSessionStatus,
): string | null {
  if (bootStatus === 'loading') return null;

  if (bootStatus === 'unauthenticated') {
    return '/login';
  }

  const isDefaultEntry = pathname === '/' || pathname === '/login';
  return isDefaultEntry ? '/command' : pathname;
}

/** True when boot may expose a Sign In action that routes toward login. */
export function bootMayRouteToLogin(bootStatus: BootSessionStatus): boolean {
  return bootStatus === 'unauthenticated';
}
