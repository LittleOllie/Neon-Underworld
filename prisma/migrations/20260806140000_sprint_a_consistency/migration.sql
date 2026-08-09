-- Sprint A: last seen, report metadata, SYSTEM report category

ALTER TABLE "PlayerStatusExt" ADD COLUMN IF NOT EXISTS "lastSeenAt" TIMESTAMP(3);

UPDATE "PlayerStatusExt" ps
SET "lastSeenAt" = u."lastLoginAt"
FROM "Player" p
JOIN "User" u ON u."id" = p."userId"
WHERE ps."playerId" = p."id" AND ps."lastSeenAt" IS NULL AND u."lastLoginAt" IS NOT NULL;

ALTER TABLE "Report" ADD COLUMN IF NOT EXISTS "metadata" JSONB;

ALTER TYPE "ReportCategory" ADD VALUE IF NOT EXISTS 'SYSTEM';
