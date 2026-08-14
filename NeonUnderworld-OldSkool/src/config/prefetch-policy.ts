/**
 * Next.js link prefetch policy for mutable gameplay routes.
 * Safe routes may prefetch; stale-risk routes disable prefetch on nav links.
 */

/** Prefetch disabled — page data mutates heavily or runs settlement on load. */
export const NO_PREFETCH_HREFS = new Set([
  '/produce',
  '/empire',
  '/attack',
  '/market',
  '/travel',
  '/cartels',
  '/businesses',
  '/reports',
]);

/** Safe to prefetch — mostly static or low stale-risk. */
export const SAFE_PREFETCH_HREFS = new Set(['/scout', '/shop', '/how-to-play', '/settings', '/command']);

export function shouldPrefetchRoute(href: string): boolean {
  return !NO_PREFETCH_HREFS.has(href);
}
