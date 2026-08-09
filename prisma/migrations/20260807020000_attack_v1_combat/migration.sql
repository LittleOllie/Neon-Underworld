-- Attack v1: CombatEncounter persistence

CREATE TYPE "AttackType" AS ENUM ('DRIVE_BY', 'HOME_INVASION', 'RAID_DRUG_LABS');
CREATE TYPE "CombatOutcome" AS ENUM ('SUCCESS', 'PARTIAL', 'REPULSED');

CREATE TABLE "CombatEncounter" (
    "id" TEXT NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "attackerId" TEXT NOT NULL,
    "defenderId" TEXT NOT NULL,
    "scoutReportId" TEXT NOT NULL,
    "attackType" "AttackType" NOT NULL,
    "turnsSpent" INTEGER NOT NULL,
    "attackingThugs" INTEGER NOT NULL,
    "ridesUsed" INTEGER NOT NULL,
    "attackerForceSnapshot" JSONB NOT NULL,
    "defenderForceSnapshot" JSONB NOT NULL,
    "attackerLosses" INTEGER NOT NULL,
    "defenderLosses" INTEGER NOT NULL,
    "attackerReturned" INTEGER NOT NULL,
    "cashStolen" INTEGER NOT NULL DEFAULT 0,
    "drugsStolen" JSONB,
    "outcome" "CombatOutcome" NOT NULL,
    "attackerReportId" TEXT,
    "defenderReportId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CombatEncounter_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "CombatEncounter_attackerId_idempotencyKey_key" ON "CombatEncounter"("attackerId", "idempotencyKey");
CREATE INDEX "CombatEncounter_attackerId_createdAt_idx" ON "CombatEncounter"("attackerId", "createdAt");
CREATE INDEX "CombatEncounter_defenderId_createdAt_idx" ON "CombatEncounter"("defenderId", "createdAt");
CREATE INDEX "CombatEncounter_attackerId_defenderId_createdAt_idx" ON "CombatEncounter"("attackerId", "defenderId", "createdAt");

ALTER TABLE "CombatEncounter" ADD CONSTRAINT "CombatEncounter_attackerId_fkey" FOREIGN KEY ("attackerId") REFERENCES "Player"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CombatEncounter" ADD CONSTRAINT "CombatEncounter_defenderId_fkey" FOREIGN KEY ("defenderId") REFERENCES "Player"("id") ON DELETE CASCADE ON UPDATE CASCADE;
