ALTER TABLE "PlayerStatusExt" ADD COLUMN "offlineDamagingHits" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "PlayerStatusExt" ADD COLUMN "offlineProtectionActive" BOOLEAN NOT NULL DEFAULT false;
