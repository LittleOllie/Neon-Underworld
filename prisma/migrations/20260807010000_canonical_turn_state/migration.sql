-- Canonical OldSkool turn rules: 2 turns / 6 minutes, cap 5000, starting 50 (registration)

ALTER TABLE "PlayerTurnState" ALTER COLUMN "turnCap" SET DEFAULT 5000;
ALTER TABLE "PlayerTurnState" ALTER COLUMN "regenerationRate" SET DEFAULT 0.0000055555555555556;

-- Preserve balances; clamp only above cap
UPDATE "PlayerTurnState"
SET
  "turnCap" = 5000,
  "regenerationRate" = 0.0000055555555555556,
  "currentTurns" = LEAST("currentTurns", 5000),
  "updatedAt" = NOW()
WHERE
  "turnCap" <> 5000
  OR ABS("regenerationRate" - 0.0000055555555555556) > 0.0000000000000001
  OR "currentTurns" > 5000;
