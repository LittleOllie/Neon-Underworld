# Architecture

## Stack

- **Next.js 15** (App Router) — UI and server
- **TypeScript** (strict) — type safety
- **PostgreSQL + Prisma** — persistence
- **Auth.js (next-auth v5)** — credentials authentication
- **Zod** — validation
- **Tailwind CSS v4** — styling
- **Vitest + Playwright** — testing

## Directory structure

```
src/
  app/           # Routes (auth, game, admin, api)
  components/    # Reusable UI (game, layout, ui)
  config/game/   # Typed game balance configuration
  features/      # Feature-specific UI logic
  lib/
    auth/        # Session and Auth.js config
    db/          # Prisma client
    game-engine/ # Pure game logic (authoritative)
    security/    # Crypto, rate limiting
    validation/  # Zod schemas
  server/
    actions/     # Server Actions (mutations)
    queries/     # Read queries
  styles/        # Global CSS and design tokens
  tests/         # Unit and integration tests
prisma/          # Schema, migrations, seed
docs/            # Documentation
e2e/             # Playwright tests
```

## Authoritative server pattern

All game mutations follow this flow:

1. Client sends action + idempotency key
2. Server validates session and input
3. Turn regeneration is recalculated
4. Game engine resolves outcome (pure functions)
5. Database transaction updates all records
6. Audit log entry created
7. Authoritative state returned to client

The browser never mutates resources directly.

## Key design decisions

- **Turn regeneration:** Derived on read/mutation from `lastRegeneratedAt` anchor — no per-player cron
- **Integer resources:** All cash and counts stored as integers
- **Idempotency keys:** Prevent duplicate scout rewards on retry
- **Serializable transactions:** Prevent concurrent turn overspend
- **Config-driven balance:** All formulas read from `src/config/game/balance.ts`
- **Label abstraction:** `LABELS` constant allows future terminology swaps

## Authentication

- Invite-only registration with bcrypt-hashed codes
- JWT sessions via Auth.js
- Middleware protects game and admin routes
- Generic login errors (no account enumeration)
- In-memory rate limit abstraction for login

## Database models

User, Player, PlayerTurnState, District, Season, InviteCode, InviteCodeUse, GameAction, EconomicAuditLog, ScoutResult, RankSnapshot, GameConfigOverride, AdminAuditLog

## Future system placeholders

Market, Operations (beyond scout), Syndicate/Cartels routes exist as polished placeholders. Game engine modules are structured for extension without rewriting core loops.
