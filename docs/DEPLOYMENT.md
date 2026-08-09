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
| `DATABASE_URL` | Set automatically when Neon is connected |
| `AUTH_SECRET` | `openssl rand -base64 32` |
| `APP_URL` | `https://neon-underworld-kappa.vercel.app` |

## First deploy checklist

1. Root Directory = `NeonUnderworld-OldSkool` (+ include files outside root)
2. Neon connected, env vars above set
3. Deploy succeeds (build log shows `OldSkool build complete`)
4. Seed once from your Mac:

```bash
DATABASE_URL="your-neon-url-from-storage-tab" npm run db:seed
```

Default invite code: `NEON-ALPHA-2026`

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
