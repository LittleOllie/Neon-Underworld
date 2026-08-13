-- CreateEnum
CREATE TYPE "BusinessType" AS ENUM ('NIGHTCLUB', 'WAREHOUSE', 'DRUG_LAB');

-- CreateTable
CREATE TABLE "Business" (
    "id" TEXT NOT NULL,
    "playerId" TEXT NOT NULL,
    "businessType" "BusinessType" NOT NULL,
    "districtId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "purchasePrice" INTEGER NOT NULL,
    "assignedWorkers" INTEGER NOT NULL DEFAULT 0,
    "safeCash" INTEGER NOT NULL DEFAULT 0,
    "hash" INTEGER NOT NULL DEFAULT 0,
    "shrooms" INTEGER NOT NULL DEFAULT 0,
    "coke" INTEGER NOT NULL DEFAULT 0,
    "heroin" INTEGER NOT NULL DEFAULT 0,
    "lastSettledAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastRaidCheckAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Business_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Business_playerId_idx" ON "Business"("playerId");

-- CreateIndex
CREATE INDEX "Business_playerId_businessType_idx" ON "Business"("playerId", "businessType");

-- CreateIndex
CREATE INDEX "Business_districtId_idx" ON "Business"("districtId");

-- AddForeignKey
ALTER TABLE "Business" ADD CONSTRAINT "Business_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Business" ADD CONSTRAINT "Business_districtId_fkey" FOREIGN KEY ("districtId") REFERENCES "District"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
