# Neon Underworld

A premium, mobile-first, turn-based criminal empire strategy game. Sprint 0 + Sprint 1 delivers the foundation and first playable vertical slice.

## Gameplay loop (Sprint 1)

Register → Enter Command Centre → Regenerate and spend turns → Scout → Receive results → View the updated Empire

## Requirements

- Node.js 20+
- PostgreSQL 16+ (or use Docker Compose)

## Installation

```bash
npm install
cp .env.example .env   # Edit values as needed
docker compose up -d   # Start PostgreSQL
npm run db:migrate
npm run db:seed
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

## Environment variables

| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | PostgreSQL connection string |
| `AUTH_SECRET` | Auth.js secret (min 32 chars). Generate: `openssl rand -base64 32` |
| `APP_URL` | Application URL (default `http://localhost:3000`) |
| `SEED_ADMIN_EMAIL` | Admin account email for seed |
| `SEED_ADMIN_PASSWORD` | Admin account password for seed |
| `SEED_INVITE_CODE` | Invite code created by seed |

## Database

```bash
npm run db:generate   # Generate Prisma client
npm run db:migrate    # Run migrations
npm run db:seed       # Seed districts, season, admin, system players
npm run db:studio     # Open Prisma Studio
```

## Development

```bash
npm run dev           # Start dev server (Turbopack)
npm run lint          # ESLint
npm run typecheck     # TypeScript
npm run test          # Vitest unit tests
npm run test:e2e      # Playwright E2E tests
npm run build         # Production build
```

## Admin login

After seeding:

- **Email:** value of `SEED_ADMIN_EMAIL` (default `admin@neonunderworld.local`)
- **Password:** value of `SEED_ADMIN_PASSWORD` (default `AdminChangeMe123!`)
- **Admin dashboard:** `/admin`

## Invite code flow

1. Admin creates invite codes in `/admin` (or use seed code)
2. New player visits `/register`
3. Enters invite code, email, password, alias, and district
4. Account, player, turn state, and starting resources are created atomically

**Seed invite code:** `NEON-ALPHA-2026` (from `SEED_INVITE_CODE`)

## Main routes

| Route | Description |
|-------|-------------|
| `/` | Redirect to login or command |
| `/login` | Sign in |
| `/register` | Invite-only registration |
| `/command` | Command Centre (primary screen) |
| `/empire` | Empire overview |
| `/rankings` | Season rankings |
| `/operations/scout` | Scout action |
| `/players/[alias]` | Public player profile |
| `/admin` | Admin dashboard |
| `/market` | Placeholder (alpha) |
| `/operations` | Operations hub |
| `/cartel` | Cartel placeholder (alpha) |
| `/syndicate` | Redirects to `/cartel` |

## Current prototype scope

**Implemented:** Auth, invite registration, districts, turns, scouting, happiness, net worth, rankings, admin, audit logging

**Implemented (OldSkool):** Scout, Produce, City Shop (support only), Empire, Rankings, Reports, Guides, bank, canonical net worth

**Not yet implemented:** Black Market auctions, combat, cartels, travel, brothels, coffee-shop businesses

## Season display

Season duration comes from the database. After UI updates, reseed to apply the **30-day** season:

```bash
npm run db:seed
```

## Architecture

See `docs/ARCHITECTURE.md`, `docs/GAME_ENGINE.md`, `docs/DESIGN_SYSTEM.md`, and `docs/PREMIUM_UI_PASS.md`.
