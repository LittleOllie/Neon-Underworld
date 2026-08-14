# Route Prefetch Policy

Neon Underworld uses selective Next.js link prefetching to avoid stale gameplay gates while keeping fast navigation on safe routes.

## Prefetch disabled (`prefetch={false}`)

These routes load mutable player state or run lazy server work on visit. Prefetching can leave RSC payloads stale relative to the live shell.

| Route | Reason |
|-------|--------|
| `/produce` | Thug gate must match live shell after Scout |
| `/empire` | Cash, NW, payout, personnel summaries |
| `/attack` | Crew, weapons, targets, intel |
| `/market` | Settlement + listings |
| `/travel` | Rides, crew, district |
| `/cartels` | Membership and treasury |
| `/businesses` | Ownership and heat |
| `/reports` | Inbox pagination and unread |

## Prefetch enabled (default)

| Route | Notes |
|-------|--------|
| `/command` | Home hub |
| `/scout` | Safe; mutations reconcile shell |
| `/shop` | Safe; mutations reconcile shell |
| `/how-to-play` | Static |
| `/settings` | Low mutation |

## Implementation

- `NeonUnderworld-OldSkool/src/config/prefetch-policy.ts` — canonical href sets
- `GameNav` / `MoreMenu` — `prefetch={shouldPrefetchRoute(href) ? undefined : false}`
- Server loaders may skip side effects when `isRoutePrefetch()` is true (e.g. market settlement)

## Future

Re-enable prefetch per route when RSC payloads are keyed to shell generation or invalidation is reliable.
