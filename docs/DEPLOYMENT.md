# Deploying Neon Underworld (OldSkool)

The playable game is **OldSkool only**. The repo root holds shared game engine code (`src/lib`, `src/server`, Prisma) — not a deployable Next.js app.

## Vercel setup

The repo includes a root `vercel.json` that builds **OldSkool** automatically — you do **not** need to change Root Directory for a standard Git deploy.

Optional (cleaner): set **Root Directory** to `NeonUnderworld-OldSkool` in Project → Settings → General, then enable **Include source files outside of the Root Directory** (OldSkool imports the shared engine from `../src`).

## Environment variables

Set these on the Vercel project (Production + Preview):

| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | PostgreSQL connection string |
| `AUTH_SECRET` | Random 32+ char secret (`openssl rand -base64 32`) |
| `APP_URL` | Your Vercel URL, e.g. `https://neon-underworld-kappa.vercel.app` |

## First deploy checklist

1. Root Directory = `NeonUnderworld-OldSkool`
2. Env vars above are set
3. Deploy (build runs `prisma migrate deploy` then `next build`)
4. Seed the production database once from your machine:

```bash
DATABASE_URL="your-production-url" npm run db:seed
```

Default invite code after seed: `NEON-ALPHA-2026`

## Local development

```bash
npm install
cd NeonUnderworld-OldSkool && npm install && cd ..
cp .env.example .env
# Edit DATABASE_URL, AUTH_SECRET; set APP_URL=http://localhost:3302 in NeonUnderworld-OldSkool/.env
npm run db:migrate
npm run db:seed
npm run dev
```

Open [http://localhost:3302](http://localhost:3302)
