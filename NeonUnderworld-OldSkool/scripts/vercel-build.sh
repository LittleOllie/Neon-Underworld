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
  # Migrations need a direct Postgres connection. Pooled Neon URLs (-pooler)
  # cannot acquire pg_advisory_lock and fail with Prisma P1002 on Vercel builds.
  MIGRATE_URL="${DATABASE_URL_UNPOOLED:-${DIRECT_DATABASE_URL:-$DATABASE_URL}}"
  if [[ "$MIGRATE_URL" == *"-pooler"* ]]; then
    MIGRATE_URL="${MIGRATE_URL//-pooler/}"
    echo "==> Using direct Neon host for migrations (removed -pooler from URL)"
  fi

  echo "==> Running migrations"
  export PRISMA_MIGRATE_ADVISORY_LOCK_TIMEOUT="${PRISMA_MIGRATE_ADVISORY_LOCK_TIMEOUT:-60000}"
  DATABASE_URL="$MIGRATE_URL" npx prisma migrate deploy --schema="$ROOT/prisma/schema.prisma"
else
  echo "WARN: DATABASE_URL not set — skipping migrations"
fi

npm run build

echo "==> OldSkool build complete"
