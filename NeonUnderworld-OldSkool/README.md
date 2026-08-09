# Neon Underworld — OldSkool Edition

Classic browser-game frontend for Neon Underworld. This is the **only** playable client.

## Quick start

```bash
# From repo root
npm install
cd NeonUnderworld-OldSkool && npm install && cd ..

npm run db:migrate --prefix .
npm run db:seed --prefix .

cp .env NeonUnderworld-OldSkool/.env
# Set APP_URL=http://localhost:3302 in NeonUnderworld-OldSkool/.env

npm run dev
```

Open [http://localhost:3302](http://localhost:3302)

## Deploying to Vercel

Set **Root Directory** to `NeonUnderworld-OldSkool` in your Vercel project settings.

See [../docs/DEPLOYMENT.md](../docs/DEPLOYMENT.md).

## Background artwork

Drop page illustrations into `public/images/game-backgrounds/` — see [README](./public/images/game-backgrounds/README.md).

Each page declares its key on `GameShell` (e.g. `background="scout"`). Add `scout.webp` and refresh; no code edits needed.

Legacy folder `public/assets/backgrounds/` is unused — use `public/images/game-backgrounds/` instead.

## Ports

| Client   | URL                      |
|----------|--------------------------|
| OldSkool | http://localhost:3302    |

## Environment

Uses the **same** `.env` values as the repo root:

- `DATABASE_URL` — shared PostgreSQL
- `AUTH_SECRET` — session signing secret
- `APP_URL` — set to `http://localhost:3302` for local dev

## Architecture

OldSkool is an isolated Next.js 15 app that imports shared game logic from the parent via `@core/*` → `../src/*`. No game formulas are duplicated.

See [docs/SHARED_ARCHITECTURE.md](./docs/SHARED_ARCHITECTURE.md).

## Routes

See [docs/ROUTES.md](./docs/ROUTES.md).

## Design

See [docs/OLDSKOOL_DESIGN.md](./docs/OLDSKOOL_DESIGN.md).

## Implementation status (Sprint A)

- Canonical OldSkool net worth on Command, Empire, Rankings, dossier, sidebar, online panel
- Live `/reports` with scout integration
- Rankings district filters (Overall, Neon Strip, Docklands, Old Quarter)
- Terminology standardised via `src/config/terminology.ts`

## Implementation status (Empire Phase 2 / Sprint B1)

- `/empire` is the full management centre via `EmpireService.getManagementData()`
- Bank deposit and withdrawal (transactional, net-worth neutral)
- Worker payout with preview and validation
- Operational readiness, arming, vehicle capacity panels
- See [docs/GAMEPLAY_RULES.md](./docs/GAMEPLAY_RULES.md)

## Implementation status (Redlite Alignment)

Rules from `docs/reference/REDLITE_AMSTERDAM_GUIDES.md` are codified in `src/config/game/redlite-rules.ts` and `src/config/game/shop-rules.ts`.

**Playable (Redlite-aligned):**
- Turn regen: 2 turns / 6 minutes · cap **5,000** · start **50**
- Scout with **5 areas per city** — primary personnel route
- **Produce** drugs (scales with thugs + turns) + worker cash split
- **City Shop** — support supplies only (**Workers and Thugs not sold**)
- Net worth: Redlite asset values; **brothels/shops excluded** from rank
- Payout: 1–100% strategic trade-off (low = profit, high = stability)
- Weapon combat capacity: Glock 2 / Uzi 25 / AK 45

**Configured, not yet playable:** Black Market auctions, Cartels, Attacks, Travel, Brothels T1–T5, Coffee shops

**Neon improvements kept:** Bank (NW-neutral transfers), canonical reports, district filters, Operations loop guidance

## Implementation status (Core Loop Alignment Sprint)

- City Shop refactored into categorized support sections with purchase preview
- Central shop pricing in `@core/config/game/shop-rules.ts`
- Server rejects forged Worker/Thug shop purchases
- Scout area clarity (High/Medium/Low tendencies)
- Produce estimates and payout split on results
- Happiness as status bands on Empire; payout trade-off copy
- `/operations` core loop hub; `/guides` updated for Neon rules

## Implementation status (UI/UX Refinement Sprint)

- Global visual system: calmer panels, gold/cyan hierarchy, compact tables, classic buttons
- Command refocused: hero stats, empire snapshot, compact reports and online list
- Sidebar notifications replace City Intel; nav and header hierarchy improved
- Scout, Reports, Rankings, Empire readability polish

**Development rule:** No new gameplay mechanic ships until the previous one feels genuinely fun to use. Polish before expansion.

## Development PvP opponents

Rankings only shows real players (`isSystemPlayer: false`). The default `db:seed` creates system filler players that do not appear in Rankings.

To populate **10 development opponents** for Scout → Intel → Attack testing:

```bash
# From repo root (after db:seed)
npm run db:seed:dev-pvp
```

This creates varied opponents across Neon Strip, Docklands, and Old Quarter with coherent inventories and net-worth spread (weaker, equal, stronger) for attack-range testing. Re-running skips aliases that already exist. Production deploys do not run this unless explicitly invoked.

## Tests

```bash
cd NeonUnderworld-OldSkool
npm run test
npm run typecheck
npm run build
```

**Lint:** `npm run lint` currently fails — see [Known issues](#known-issues).

## Known issues

**ESLint (not fixed this sprint):** OldSkool inherits `eslint-config-next` from the parent repo. ESLint 9 + `@rushstack/eslint-patch` fails with:

```
Cannot read config file: .../node_modules/eslint-config-next/index.js
Failed to patch ESLint because the calling module was not recognized.
```

Owner: parent `node_modules/eslint-config-next/core-web-vitals.js`. Build uses `eslint.ignoreDuringBuilds: true` in `next.config.ts`.

**Prisma client sync:** After schema migrations, run `npm install` in `NeonUnderworld-OldSkool/` (postinstall copies generated client from parent) or `npx prisma generate --schema=../prisma/schema.prisma` from repo root then copy to OldSkool.

## Comparing clients

1. Log into OldSkool at `:3302`, scout 100 turns, note resources.
2. Log into Modern at `:3100` with the same account — state matches after refresh.
3. Scout from Modern — change appears in OldSkool after refresh.

Both clients share one database and one Prisma schema at the repo root.
