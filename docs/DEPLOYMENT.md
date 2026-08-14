# Deploying Neon Underworld (OldSkool)

## Required: Vercel Root Directory

The live site **will 500** unless this is set:

1. Vercel → your **neon-underworld** project
2. **Settings** → **General**
3. **Root Directory** → **Edit**
4. Enter: `NeonUnderworld-OldSkool`
5. Enable **Include source files outside of the Root Directory in the Build Step**
6. **Save**

Then **Deployments** → **Redeploy** the latest commit.

The playable app lives in `NeonUnderworld-OldSkool/`. The repo root is shared engine code only (`src/`, `prisma/`).

## Environment variables

In **Settings → Environment Variables** (Production + Preview):

| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | Pooled Neon URL for runtime (hostname contains `-pooler`) |
| `DATABASE_URL_UNPOOLED` | Optional — direct Neon URL for migrations. If omitted, the build strips `-pooler` from `DATABASE_URL` automatically. |
| `AUTH_SECRET` | `openssl rand -base64 32` |
| `APP_URL` | `https://neon-underworld-kappa.vercel.app` |
| `PLAYTEST_TURNS` | **Must be omitted or `false` in production.** Dev/test only — enables `/playtest/turns`. Production build **rejects** `true`. |
| `NEXT_PUBLIC_PLAYTEST_TURNS` | **Must be omitted or `false` in production.** Client nav for Add Turns. Production build **rejects** `true`. |

### Production security (required)

Before closed testing or public launch:

1. **Rotate admin password** — do not use seed default `AdminChangeMe123!`. Set `SEED_ADMIN_PASSWORD` only when running seed locally; store a unique production password in your secrets manager.
2. **Rotate invite code** — do not use default `NEON-ALPHA-2026` in production. Create a fresh invite via seed with `SEED_INVITE_CODE` or admin tooling.
3. **`AUTH_SECRET`** — generate with `openssl rand -base64 32`; never commit or reuse dev values.
4. **`DATABASE_URL`** — pooled Neon URL for runtime; direct URL for migrations only.
5. **Playtest flags disabled** — confirm `PLAYTEST_TURNS` and `NEXT_PUBLIC_PLAYTEST_TURNS` are unset or `false`.
6. **Legacy bankCash** — run read-only diagnostic before deploy:
   ```bash
   DATABASE_URL="direct-url" npm run db:check:legacy-bank-cash
   ```
   If counts > 0, document and run one-time cleanup (operator only):
   ```bash
   DATABASE_URL="direct-url" npx tsx scripts/normalize-bank-cash.ts
   ```

## First deploy checklist

1. Root Directory = `NeonUnderworld-OldSkool` (+ include files outside root)
2. Neon connected, env vars above set
3. Deploy succeeds (build log shows `OldSkool build complete`)
4. Seed once from your Mac (dev credentials only — rotate before testers):

```bash
SEED_ADMIN_PASSWORD="your-strong-dev-password" SEED_INVITE_CODE="your-dev-invite-only" DATABASE_URL="your-neon-url-from-storage-tab" npm run db:seed
```

**DEV ONLY:** Example invite codes and passwords in `.env.example` must not be used in production.

### Database migrations

Vercel builds **do not** run migrations by default (avoids Prisma P1002 lock timeouts on Neon).

When you change the Prisma schema, migrate from your Mac using Neon’s **direct** connection string:

```bash
DATABASE_URL="postgresql://...@ep-xxxx.region.aws.neon.tech/neondb?sslmode=require" npx prisma migrate deploy
```

Or enable one deploy with migrations: set `RUN_DB_MIGRATE=true` in Vercel env vars, deploy, then remove it.

## Performance (important for Vercel)

Each page navigation hits the server and Neon Postgres. For noticeably faster loads:

### 1. Use Neon’s pooled connection string

In **Vercel → Settings → Environment Variables**, set `DATABASE_URL` to the **pooled** connection string from Neon (hostname contains `-pooler`), not the direct connection.

In Neon: **Dashboard → Connection details → Pooled connection**.

Example shape:
`postgresql://user:pass@ep-xxxx-pooler.region.aws.neon.tech/neondb?sslmode=require`

Direct (non-pooled) URLs add latency on every serverless cold start and can exhaust connections under load.

**Do not** run migrations through the pooled URL. Runtime should use pooled; migrate manually with the direct URL when needed.

If a deploy fails with **Prisma P1002**, migrations are no longer run automatically on build — redeploy after this fix or run migrations locally.

### Migration workflow (Pass 4)

1. **Develop locally** — `npm run db:migrate` creates migration files.
2. **Before promoting code** — apply migrations to production using the **direct** Neon URL:
   ```bash
   DATABASE_URL="direct-url" npx tsx scripts/check-migration-status.ts
   DATABASE_URL="direct-url" npx prisma migrate deploy
   ```
3. **Deploy application** — Vercel build does not migrate by default.
4. **Verify** — re-run `check-migration-status.ts` against production if unsure.

Optional one-off deploy with migrations: set `RUN_DB_MIGRATE=true` in Vercel, deploy once, then remove.

**Never** run migrations through the pooled `-pooler` URL.

### Legacy bankCash cleanup

If players have hidden `bankCash` balances from pre–Pass 4 data:

```bash
DATABASE_URL="direct-url" npx tsx scripts/normalize-bank-cash.ts
```

Run once after deploy; safe to re-run (idempotent).

### 2. Playtest NPC seed (optional)

```bash
DATABASE_URL="your-neon-pooled-url" npm run db:seed:playtest-npcs
```

## Local development

```bash
npm install
cd NeonUnderworld-OldSkool && npm install && cd ..
cp .env.example .env
cp .env NeonUnderworld-OldSkool/.env
# APP_URL=http://localhost:3302 in NeonUnderworld-OldSkool/.env
npm run db:migrate
npm run db:seed
npm run dev
```

Open [http://localhost:3302](http://localhost:3302)
