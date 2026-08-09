# Shared Architecture — Modern + OldSkool

## Principle

**One source of truth** for game logic, database, and authentication rules.

## Structure

```
Neon-Underworld/                 ← modern client (repo root)
  src/
    lib/game-engine/             ← turns, scouting, net worth, happiness
    lib/db/prisma.ts
    lib/auth/
    server/actions/
    server/queries/
  prisma/schema.prisma

NeonUnderworld-OldSkool/         ← experimental client
  src/
    app/                         ← OldSkool routes only
    components/oldskool/         ← classic UI shell
    lib/auth/config.ts           ← OldSkool auth (same credentials provider)
  next.config.ts                 ← @core alias + externalDir
```

## Import strategy

OldSkool imports parent modules via `@core/*`:

```typescript
import { scoutAction } from '@core/server/actions/scout.actions';
import { getPlayerState } from '@core/server/queries/player.queries';
import { TERMS } from '@core/config/game/terminology';
```

Webpack resolves `@/` inside parent modules to `../src/` via dual alias fallback.

## What is NOT duplicated

- Scouting formulas
- Turn regeneration
- Happiness logic
- **City Shop rules and pricing** (`@core/config/game/shop-rules.ts`)
- Production and worker economics
- Prisma schema / migrations
- Invite validation
- Audit logging
- Server action transaction boundaries (core scout/payout/register)

## OldSkool-specific (not shared with Modern UI)

- **Net worth** — OldSkool uses `NeonUnderworld-OldSkool/src/config/valuations.ts` and `NetWorthService`. The parent `calculateNetWorth()` excludes bank cash and businesses; OldSkool UI must never use it.
- **Rankings** — `RankingsService` batch-calculates canonical net worth for all rows.
- **Reports** — `ReportService` owns private player reports (SCOUT, SYSTEM, …).
- **Empire management** — `EmpireService.getManagementData()`, `BankService`, `src/config/empire-rules.ts`.
- **Terminology** — `src/config/terminology.ts` maps DB fields to player-facing labels (Workers, City, Thugs).
- **Server action wrappers** — client components import `@local/server/actions/*` only, never `@core/server/actions/*` directly.

```typescript
// ✅ Client component
import { scoutAction } from '@local/server/actions/scout.actions';

// ❌ Never in client components
import { scoutAction } from '@core/server/actions/scout.actions';
```

## Database

Both apps use `DATABASE_URL` pointing at the same PostgreSQL instance. Prisma client is generated from `../prisma/schema.prisma` on OldSkool `postinstall`.

## Authentication

- Same `AUTH_SECRET` and credential store
- Separate JWT session cookies per port (3100 vs 3302)
- Login required on each client independently
- Player state is identical after login on either client

## Running

| Script | Command |
|--------|---------|
| Modern | `npm run dev:modern` |
| OldSkool | `npm run dev:oldskool` |

## Future monorepo

If import boundaries become fragile, extract `packages/game-engine` and `packages/database`. No migration performed in this sprint — least-risk separate-app approach chosen.
