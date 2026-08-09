-- Phase 1: Command core infrastructure

CREATE TYPE "PlayerLifeStatus" AS ENUM ('ACTIVE', 'TRAVELLING', 'HOSPITALIZED', 'JAIL', 'INACTIVE');
CREATE TYPE "ProtectionLevel" AS ENUM ('NONE', 'STANDARD', 'PREMIUM');
CREATE TYPE "ActivityCategory" AS ENUM ('LOGIN', 'RECRUIT', 'PURCHASE', 'PRODUCE', 'TRAVEL', 'ATTACK', 'MARKET', 'SCOUT', 'SYSTEM');
CREATE TYPE "ReportCategory" AS ENUM ('TRAVEL', 'COMBAT', 'SCOUT', 'MARKET');

ALTER TABLE "Player" ADD COLUMN "avatar" TEXT;
ALTER TABLE "Player" ADD COLUMN "cartelId" TEXT;
ALTER TABLE "Player" ADD COLUMN "bankCash" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Player" ADD COLUMN "health" INTEGER NOT NULL DEFAULT 100;
ALTER TABLE "Player" ADD COLUMN "lifeStatus" "PlayerLifeStatus" NOT NULL DEFAULT 'ACTIVE';
ALTER TABLE "Player" ADD COLUMN "travelling" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Player" ADD COLUMN "travelDestination" TEXT;
ALTER TABLE "Player" ADD COLUMN "travelArrival" TIMESTAMP(3);
ALTER TABLE "Player" ADD COLUMN "protectionStatus" "ProtectionLevel" NOT NULL DEFAULT 'NONE';
ALTER TABLE "Player" ADD COLUMN "businesses" INTEGER NOT NULL DEFAULT 0;

CREATE TABLE "PlayerInventory" (
    "id" TEXT NOT NULL,
    "playerId" TEXT NOT NULL,
    "thugs" INTEGER NOT NULL DEFAULT 0,
    "workers" INTEGER NOT NULL DEFAULT 0,
    "weapons" INTEGER NOT NULL DEFAULT 0,
    "vehicles" INTEGER NOT NULL DEFAULT 0,
    "drugs" INTEGER NOT NULL DEFAULT 0,
    "businesses" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "PlayerInventory_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PlayerStatusExt" (
    "id" TEXT NOT NULL,
    "playerId" TEXT NOT NULL,
    "notification" TEXT,
    "unreadReports" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "PlayerStatusExt_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Activity" (
    "id" TEXT NOT NULL,
    "playerId" TEXT NOT NULL,
    "category" "ActivityCategory" NOT NULL,
    "message" TEXT NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Activity_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Report" (
    "id" TEXT NOT NULL,
    "playerId" TEXT NOT NULL,
    "category" "ReportCategory" NOT NULL,
    "title" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "body" TEXT,
    "read" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Report_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PlayerInventory_playerId_key" ON "PlayerInventory"("playerId");
CREATE UNIQUE INDEX "PlayerStatusExt_playerId_key" ON "PlayerStatusExt"("playerId");
CREATE INDEX "Activity_playerId_createdAt_idx" ON "Activity"("playerId", "createdAt");
CREATE INDEX "Report_playerId_read_createdAt_idx" ON "Report"("playerId", "read", "createdAt");

ALTER TABLE "PlayerInventory" ADD CONSTRAINT "PlayerInventory_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PlayerStatusExt" ADD CONSTRAINT "PlayerStatusExt_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Activity" ADD CONSTRAINT "Activity_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Report" ADD CONSTRAINT "Report_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Backfill inventory from existing player resources
INSERT INTO "PlayerInventory" ("id", "playerId", "thugs", "workers", "weapons", "vehicles", "drugs", "businesses", "updatedAt")
SELECT
  p."id" || '_inv',
  p."id",
  p."thugs",
  p."prostitutes",
  p."glocks" + p."uzis" + p."aks",
  p."rides",
  p."hash" + p."shrooms" + p."coke" + p."heroin",
  p."businesses",
  NOW()
FROM "Player" p
WHERE NOT EXISTS (SELECT 1 FROM "PlayerInventory" pi WHERE pi."playerId" = p."id");

INSERT INTO "PlayerStatusExt" ("id", "playerId", "unreadReports", "updatedAt")
SELECT p."id" || '_status', p."id", 0, NOW()
FROM "Player" p
WHERE NOT EXISTS (SELECT 1 FROM "PlayerStatusExt" ps WHERE ps."playerId" = p."id");
