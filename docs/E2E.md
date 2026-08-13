# E2E Testing

Playwright tests live in `NeonUnderworld-OldSkool/e2e/`. They **must never** run against production.

## Test database

- Set `DATABASE_URL` in `NeonUnderworld-OldSkool/.env` to a **dedicated dev/test** Neon branch or local Postgres.
- Default admin credentials (from seed): `admin@neonunderworld.local` / `AdminChangeMe123!`
- Override via `SEED_ADMIN_EMAIL` and `SEED_ADMIN_PASSWORD` env vars.

## Seed & reset

```bash
# From repo root
npm run db:seed
npm run db:seed:dev-pvp   # optional combat NPCs

# Combat E2E prep (attack flows)
npx tsx scripts/e2e-combat-setup.ts

# Clear intel (attack empty state)
npx tsx scripts/e2e-clear-intel.ts
```

Re-run seeds between suites if tests mutate shared admin state.

## Running tests

```bash
cd NeonUnderworld-OldSkool
npm run test:e2e                    # all specs
npx playwright test e2e/pass3-responsive.spec.ts
npx playwright test e2e/pass4-core-flows.spec.ts
```

Playwright starts its own dev server on port **3310** (`playwright.config.ts`).

## Boot screen

E2E helpers dismiss the intro overlay via `.nu-boot__enter` and use in-app navigation (`gotoGame`) to avoid re-triggering boot on every `page.goto`.

## NPC seed safety

`npm run db:seed:playtest-npcs` is for dev/playtest only. Do not run against production without explicit intent.
