-- Player identity: uploaded PFP + personal accent theme
CREATE TYPE "PlayerAvatarSource" AS ENUM ('CHARACTER', 'UPLOAD');

ALTER TABLE "Player" ADD COLUMN "avatarSource" "PlayerAvatarSource";
ALTER TABLE "Player" ADD COLUMN "pfpUrl" TEXT;
ALTER TABLE "Player" ADD COLUMN "themePrimary" TEXT;
ALTER TABLE "Player" ADD COLUMN "themeSecondary" TEXT;

-- Existing character avatars remain valid identity
UPDATE "Player"
SET "avatarSource" = 'CHARACTER'
WHERE "avatar" IS NOT NULL AND "avatarSource" IS NULL;
