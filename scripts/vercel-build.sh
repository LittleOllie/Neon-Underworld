#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
OLDSKOOL="$ROOT/NeonUnderworld-OldSkool"

echo "==> Generating Prisma client at repo root"
cd "$ROOT"
npx prisma generate --schema="$ROOT/prisma/schema.prisma"

if [[ ! -d "$ROOT/node_modules/.prisma/client" ]]; then
  echo "ERROR: Prisma client missing at $ROOT/node_modules/.prisma/client"
  exit 1
fi

echo "==> Building OldSkool"
cd "$OLDSKOOL"

if [[ -n "${DATABASE_URL:-}" ]]; then
  echo "==> Running migrations"
  npx prisma migrate deploy --schema="$ROOT/prisma/schema.prisma"
else
  echo "WARN: DATABASE_URL not set — skipping migrations"
fi

npm run build

echo "==> Copying Next.js output to repo root for Vercel"
cd "$ROOT"
rm -rf .next public
cp -R "$OLDSKOOL/.next" .next
cp -R "$OLDSKOOL/public" public

echo "==> Vercel build complete"
