-- Businesses V1.2: timed upgrades
ALTER TABLE "Business" ADD COLUMN "upgradeTargetLevel" INTEGER;
ALTER TABLE "Business" ADD COLUMN "upgradeStartedAt" TIMESTAMP(3);
ALTER TABLE "Business" ADD COLUMN "upgradeCompletesAt" TIMESTAMP(3);
