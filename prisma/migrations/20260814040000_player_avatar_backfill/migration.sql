-- Existing players without an avatar receive Viper as the default identity.
-- New registrations after this migration leave avatar NULL until identity selection.
UPDATE "Player"
SET "avatar" = 'viper'
WHERE "avatar" IS NULL;
