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
  '/admin',
] as const;

export function isProtectedGameRoute(pathname: string): boolean {
  return BOOT_PROTECTED_GAME_ROUTE_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

/** Intro boot is game-only — never block admin, auth, or API routes. */
export function shouldSkipBootScreen(pathname: string): boolean {
  return (
    pathname.startsWith('/admin') ||
    pathname.startsWith('/login') ||
    pathname.startsWith('/register') ||
    pathname.startsWith('/forgot-password') ||
    pathname.startsWith('/reset-password') ||
    pathname.startsWith('/api/')
  );
}

/**
 * Map NextAuth client status to boot copy state.
 * Game routes trust middleware — if the page rendered, the session cookie was valid.
 * Client useSession can lag or fail during dev HMR; it must not block Enter.
 */
export function resolveBootSessionStatus(
  sessionStatus: ClientSessionStatus,
  pathname: string,
): BootSessionStatus {
  if (isProtectedGameRoute(pathname)) return 'authenticated';
  if (sessionStatus === 'loading') return 'loading';
  if (sessionStatus === 'authenticated') return 'authenticated';
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

/**
 * Dismiss target when the player clicks Enter — never block on client session stalls
 * when middleware already placed them on a protected game route.
 */
export function resolveBootDismissTargetForClick(
  pathname: string,
  bootStatus: BootSessionStatus,
): string {
  const resolved = resolveBootDismissTarget(pathname, bootStatus);
  if (resolved) return resolved;

  if (isProtectedGameRoute(pathname)) {
    return pathname === '/' || pathname === '/login' ? '/command' : pathname;
  }

  return '/login';
}

/** True when boot may expose a Sign In action that routes toward login. */
export function bootMayRouteToLogin(bootStatus: BootSessionStatus): boolean {
  return bootStatus === 'unauthenticated';
}

/**
 * Enter is only actionable once the client session has settled — even on protected
 * game routes where middleware already passed, an early click before useSession
 * resolves can dismiss the boot into an empty shell and trap the player.
 */
export function isBootEnterReady(
  sessionStatus: ClientSessionStatus,
  bootStatus: BootSessionStatus,
): boolean {
  return sessionStatus !== 'loading' && bootStatus !== 'loading';
}
