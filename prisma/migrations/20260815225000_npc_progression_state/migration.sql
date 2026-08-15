-- CreateTable
CREATE TABLE "NpcProgressionState" (
    "playerId" TEXT NOT NULL,
    "archetype" TEXT NOT NULL,
    "growthSeed" INTEGER NOT NULL,
    "ladderSlot" INTEGER NOT NULL,
    "lastProgressedDay" INTEGER NOT NULL DEFAULT 1,
    "lastProgressedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NpcProgressionState_pkey" PRIMARY KEY ("playerId")
);

-- CreateIndex
CREATE INDEX "NpcProgressionState_lastProgressedDay_idx" ON "NpcProgressionState"("lastProgressedDay");

-- AddForeignKey
ALTER TABLE "NpcProgressionState" ADD CONSTRAINT "NpcProgressionState_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE CASCADE ON UPDATE CASCADE;
