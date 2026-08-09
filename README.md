# Neon Underworld

Turn-based criminal empire strategy game — **OldSkool Edition** is the only playable client.

The repo root contains the shared game engine (combat, turns, scouting, Prisma schema). The UI lives in `NeonUnderworld-OldSkool/`.

## Quick start

```bash
npm install
cd NeonUnderworld-OldSkool && npm install && cd ..

cp .env.example .env
cp .env NeonUnderworld-OldSkool/.env
# Set APP_URL=http://localhost:3302 in NeonUnderworld-OldSkool/.env

docker compose up -d   # PostgreSQL (optional if you have a local DB)
npm run db:migrate
npm run db:seed
npm run dev
```

Open [http://localhost:3302](http://localhost:3302)

## Environment variables

| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | PostgreSQL connection string |
| `AUTH_SECRET` | Auth.js secret (min 32 chars). Generate: `openssl rand -base64 32` |
| `APP_URL` | `http://localhost:3302` locally; your Vercel URL in production |
| `SEED_INVITE_CODE` | Invite code created by seed (default `NEON-ALPHA-2026`) |

## Database

```bash
npm run db:migrate    # Run migrations
npm run db:seed       # Seed districts, season, admin, invite code
npm run db:seed:dev-pvp  # Optional — local PvP test opponents
npm run db:studio     # Prisma Studio
```

## Scripts

```bash
npm run dev           # OldSkool dev server (port 3302)
npm run build         # OldSkool production build
npm run test          # Core engine unit tests
npm run test:e2e      # OldSkool Playwright tests
npm run typecheck     # TypeScript (engine + OldSkool)
```

## Deploying to Vercel

**Important:** set Vercel **Root Directory** to `NeonUnderworld-OldSkool`.

See [docs/DEPLOYMENT.md](./docs/DEPLOYMENT.md) for full steps.

## Admin login (after seed)

- **Email:** `admin@neonunderworld.local` (or `SEED_ADMIN_EMAIL`)
- **Password:** `AdminChangeMe123!` (or `SEED_ADMIN_PASSWORD`)
- **Invite code for new players:** `NEON-ALPHA-2026`

## Architecture

| Path | Purpose |
|------|---------|
| `src/lib/game-engine/` | Shared rules (combat, turns, net worth, etc.) |
| `src/server/` | Shared server actions and services |
| `prisma/` | Database schema and migrations |
| `NeonUnderworld-OldSkool/` | Next.js UI — the game you play |

OldSkool imports engine code via `@core/*` → `../src/*`. See [NeonUnderworld-OldSkool/docs/SHARED_ARCHITECTURE.md](./NeonUnderworld-OldSkool/docs/SHARED_ARCHITECTURE.md).

## Docs

- [Deployment](./docs/DEPLOYMENT.md)
- [OldSkool routes](./NeonUnderworld-OldSkool/docs/ROUTES.md)
- [Gameplay rules](./NeonUnderworld-OldSkool/docs/GAMEPLAY_RULES.md)
- [Architecture](./docs/ARCHITECTURE.md)
