-- Worker Poaching attack type + encounter tracking

ALTER TYPE "AttackType" ADD VALUE 'POACH_WORKERS';

ALTER TABLE "CombatEncounter" ADD COLUMN "workersStolen" INTEGER NOT NULL DEFAULT 0;
