#!/usr/bin/env bash
set -euo pipefail

OLDSKOOL="$(cd "$(dirname "$0")/.." && pwd)"
ROOT="$(cd "$OLDSKOOL/.." && pwd)"

echo "==> Installing repo root dependencies (shared engine + Prisma)"
cd "$ROOT"
npm install

echo "==> Generating Prisma client at repo root"
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

echo "==> OldSkool build complete"
