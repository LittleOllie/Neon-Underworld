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

# Migrations are NOT run on every Vercel build — pooled Neon URLs and concurrent
# deploys often fail with Prisma P1002 (advisory lock timeout). The production DB
# is already migrated; run migrations manually when the schema changes:
#
#   DATABASE_URL="neon-direct-url" npm run db:migrate
#
# Or set RUN_DB_MIGRATE=true in Vercel for a one-off deploy after adding migrations.
if [[ "${RUN_DB_MIGRATE:-}" == "true" && -n "${DATABASE_URL:-}" ]]; then
  MIGRATE_URL="${DATABASE_URL_UNPOOLED:-${DIRECT_DATABASE_URL:-$DATABASE_URL}}"
  if [[ "$MIGRATE_URL" == *"-pooler"* ]]; then
    MIGRATE_URL="${MIGRATE_URL//-pooler/}"
    echo "==> Using direct Neon host for migrations (removed -pooler from URL)"
  fi

  echo "==> Running migrations (RUN_DB_MIGRATE=true)"
  export PRISMA_MIGRATE_ADVISORY_LOCK_TIMEOUT="${PRISMA_MIGRATE_ADVISORY_LOCK_TIMEOUT:-60000}"
  DATABASE_URL="$MIGRATE_URL" npx prisma migrate deploy --schema="$ROOT/prisma/schema.prisma"
else
  echo "==> Skipping migrations (default). Set RUN_DB_MIGRATE=true to migrate on deploy."
fi

npm run build

echo "==> OldSkool build complete"
