import type { BootSessionStatus } from '@local/config/boot-screen';

/** NextAuth client session status — loading must never be treated as logged out. */
export type ClientSessionStatus = 'loading' | 'authenticated' | 'unauthenticated';

/**
 * Game and auth routes where middleware/server auth already gate access.
 * Boot overlay is skipped so deep links and relaunches are not hijacked client-side.
 */
export const BOOT_SKIP_ROUTE_PREFIXES = [
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

/** Entry/auth routes where the boot intro may still appear. */
export const BOOT_ENTRY_ROUTE_PREFIXES = ['/', '/login', '/register'] as const;

export function shouldSkipBootOverlay(pathname: string): boolean {
  if (BOOT_ENTRY_ROUTE_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`))) {
    return false;
  }
  return BOOT_SKIP_ROUTE_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

/** Map NextAuth client status to boot copy state — loading never becomes unauthenticated. */
export function resolveBootSessionStatus(sessionStatus: ClientSessionStatus): BootSessionStatus {
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

/** True when boot may expose a Sign In action that routes toward login. */
export function bootMayRouteToLogin(bootStatus: BootSessionStatus): boolean {
  return bootStatus === 'unauthenticated';
}
