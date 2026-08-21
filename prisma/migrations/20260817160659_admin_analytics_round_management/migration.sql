-- AlterTable
ALTER TABLE "AdminAuditLog" ADD COLUMN     "seasonId" TEXT;

-- AlterTable
ALTER TABLE "Player" ADD COLUMN     "seasonActivatedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "Season" ADD COLUMN     "endedAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "GameplayEvent" (
    "id" TEXT NOT NULL,
    "seasonId" TEXT NOT NULL,
    "playerId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GameplayEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlayerDailySnapshot" (
    "id" TEXT NOT NULL,
    "seasonId" TEXT NOT NULL,
    "playerId" TEXT NOT NULL,
    "roundDay" INTEGER NOT NULL,
    "netWorth" INTEGER NOT NULL,
    "cash" INTEGER NOT NULL,
    "bankCash" INTEGER NOT NULL,
    "turns" INTEGER NOT NULL,
    "workers" INTEGER NOT NULL,
    "thugs" INTEGER NOT NULL,
    "businesses" INTEGER NOT NULL,
    "districtId" TEXT NOT NULL,
    "rank" INTEGER,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PlayerDailySnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlayerSeasonArchive" (
    "id" TEXT NOT NULL,
    "seasonId" TEXT NOT NULL,
    "playerId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "alias" TEXT NOT NULL,
    "avatar" TEXT,
    "districtId" TEXT NOT NULL,
    "finalRank" INTEGER,
    "finalNetWorth" INTEGER NOT NULL,
    "finalWorkers" INTEGER NOT NULL,
    "finalThugs" INTEGER NOT NULL,
    "finalBusinesses" INTEGER NOT NULL,
    "activatedAt" TIMESTAMP(3),
    "archivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "metadata" JSONB,

    CONSTRAINT "PlayerSeasonArchive_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "GameplayEvent_seasonId_eventType_createdAt_idx" ON "GameplayEvent"("seasonId", "eventType", "createdAt");

-- CreateIndex
CREATE INDEX "GameplayEvent_seasonId_createdAt_idx" ON "GameplayEvent"("seasonId", "createdAt");

-- CreateIndex
CREATE INDEX "GameplayEvent_playerId_createdAt_idx" ON "GameplayEvent"("playerId", "createdAt");

-- CreateIndex
CREATE INDEX "PlayerDailySnapshot_seasonId_roundDay_idx" ON "PlayerDailySnapshot"("seasonId", "roundDay");

-- CreateIndex
CREATE UNIQUE INDEX "PlayerDailySnapshot_seasonId_playerId_roundDay_key" ON "PlayerDailySnapshot"("seasonId", "playerId", "roundDay");

-- CreateIndex
CREATE INDEX "PlayerSeasonArchive_playerId_idx" ON "PlayerSeasonArchive"("playerId");

-- CreateIndex
CREATE INDEX "PlayerSeasonArchive_seasonId_idx" ON "PlayerSeasonArchive"("seasonId");

-- CreateIndex
CREATE INDEX "PlayerSeasonArchive_userId_idx" ON "PlayerSeasonArchive"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "PlayerSeasonArchive_seasonId_playerId_key" ON "PlayerSeasonArchive"("seasonId", "playerId");

-- CreateIndex
CREATE INDEX "AdminAuditLog_seasonId_createdAt_idx" ON "AdminAuditLog"("seasonId", "createdAt");

-- CreateIndex
CREATE INDEX "AdminAuditLog_action_createdAt_idx" ON "AdminAuditLog"("action", "createdAt");

-- CreateIndex
CREATE INDEX "Player_seasonId_seasonActivatedAt_idx" ON "Player"("seasonId", "seasonActivatedAt");

-- AddForeignKey
ALTER TABLE "GameplayEvent" ADD CONSTRAINT "GameplayEvent_seasonId_fkey" FOREIGN KEY ("seasonId") REFERENCES "Season"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GameplayEvent" ADD CONSTRAINT "GameplayEvent_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlayerDailySnapshot" ADD CONSTRAINT "PlayerDailySnapshot_seasonId_fkey" FOREIGN KEY ("seasonId") REFERENCES "Season"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlayerDailySnapshot" ADD CONSTRAINT "PlayerDailySnapshot_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlayerSeasonArchive" ADD CONSTRAINT "PlayerSeasonArchive_seasonId_fkey" FOREIGN KEY ("seasonId") REFERENCES "Season"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlayerSeasonArchive" ADD CONSTRAINT "PlayerSeasonArchive_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE CASCADE ON UPDATE CASCADE;
