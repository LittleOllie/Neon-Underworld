# Deploying Neon Underworld (OldSkool)

The playable game is **OldSkool only**. The repo root holds shared game engine code (`src/lib`, `src/server`, Prisma) — not a deployable Next.js app.

## Vercel setup

In **Project → Settings → General → Root Directory**:

1. Set **Root Directory** to `NeonUnderworld-OldSkool`
2. Save and redeploy

If Root Directory is left blank, Vercel builds the wrong target and routes like `/register` will fail.

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
