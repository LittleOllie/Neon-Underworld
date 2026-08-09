# Shared Architecture — OldSkool + game engine

## Principle

**One source of truth** for game logic, database, and authentication rules. OldSkool is the only playable UI.

## Structure

```
Neon-Underworld/                 ← repo root (game engine, not a deployable app)
  src/
    lib/game-engine/             ← turns, scouting, combat, net worth
    lib/db/prisma.ts
    lib/auth/
    server/actions/
    server/queries/
  prisma/schema.prisma

NeonUnderworld-OldSkool/         ← Next.js app (deploy this)
  src/
    app/                         ← routes, login, register, command, …
    components/oldskool/         ← classic UI shell
    lib/auth/config.ts           ← auth (same credentials provider)
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

- Scouting, combat, and turn formulas
- Happiness and production logic
- City Shop rules (`@core/config/game/shop-rules.ts`)
- Prisma schema / migrations
- Invite validation and audit logging
- Server action transaction boundaries

## OldSkool-specific

- **Net worth** — `NeonUnderworld-OldSkool/src/config/valuations.ts` and `NetWorthService`
- **Rankings** — `RankingsService` batch-calculates canonical net worth
- **Reports** — `ReportService` for scout/combat reports
- **Empire** — `EmpireService`, `BankService`, `src/config/empire-rules.ts`
- **Terminology** — `src/config/terminology.ts`
- **Server action wrappers** — client components use `@local/server/actions/*` only

## Database

Single PostgreSQL via `DATABASE_URL`. Prisma client is generated from `../prisma/schema.prisma` on OldSkool `postinstall`.

## Authentication

- `AUTH_SECRET` signs JWT sessions
- Same credential store for all players
- Set `APP_URL` to your OldSkool origin (local: `http://localhost:3302`)

## Running

```bash
npm run dev    # from repo root → OldSkool on :3302
```

## Deploying

Vercel **Root Directory** must be `NeonUnderworld-OldSkool`. See [../../docs/DEPLOYMENT.md](../../docs/DEPLOYMENT.md).
