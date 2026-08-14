-- Offline protection: track continuous online session for 30-minute reset eligibility.
ALTER TABLE "PlayerStatusExt" ADD COLUMN "onlineSessionStartedAt" TIMESTAMP(3);
