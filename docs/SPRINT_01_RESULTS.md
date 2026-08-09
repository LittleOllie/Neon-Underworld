# Sprint 01 Results

## Delivered

### Foundation (Sprint 0)
- [x] Next.js + TypeScript + Tailwind project
- [x] PostgreSQL + Prisma schema and migrations
- [x] Environment validation
- [x] Auth.js credentials authentication
- [x] Invite-only registration
- [x] Admin role and dashboard
- [x] Seed script (districts, season, admin, 45 system players)
- [x] ESLint + Prettier + Vitest + Playwright

### Gameplay (Sprint 1)
- [x] Turn regeneration engine (continuous, capped)
- [x] Scout action (server-authoritative, idempotent)
- [x] Happiness framework (prostitute + thug)
- [x] Net worth calculation
- [x] Rankings with movement indicators
- [x] Economic audit logging
- [x] Payout percentage adjustment

### Product
- [x] Command Centre (`/command`)
- [x] Empire overview (`/empire`)
- [x] Scout flow (`/operations/scout`)
- [x] Rankings (`/rankings`)
- [x] Public profiles (`/players/[alias]`)
- [x] Placeholder routes (market, syndicate)
- [x] Mobile-first responsive layout

## Known limitations

- Shop/market not implemented (supplies seeded at start)
- No combat, cartels, businesses, travel, or drug production
- Rankings use polling via page refresh (no WebSocket)
- Login rate limit is in-memory (resets on server restart)
- Admin sub-routes (`/admin/users`, etc.) consolidated into single dashboard
- E2E tests require running dev server and seeded database

## Recommended Sprint 2 sequence

1. **Market / Shop** — buy hash, condoms, beer, weapons
2. **Businesses** — brothels, coffee shops (passive income)
3. **Production** — drug manufacturing loop
4. **Enhanced Operations** — produce action, collect from businesses
5. **Season transitions** — end/start season flow
6. **Realtime rankings** — SSE or polling endpoint

## Test coverage

- Unit: turns, net worth, scouting, happiness, recommendations, RNG
- E2E: registration → scout → empire flow, mobile viewport
