-- Normalise ActivityCategory enum to canonical OldSkool activity types

CREATE TYPE "ActivityCategory_new" AS ENUM (
  'LOGIN',
  'SCOUT',
  'RECRUIT_THUGS',
  'RECRUIT_WORKERS',
  'PRODUCTION',
  'SHOP_PURCHASE',
  'MARKET_LISTING',
  'MARKET_BID',
  'MARKET_SALE',
  'TRAVEL',
  'ATTACK',
  'DEFENCE',
  'BUSINESS',
  'CARTEL',
  'SYSTEM'
);

ALTER TABLE "Activity" ALTER COLUMN "category" TYPE "ActivityCategory_new" USING (
  CASE "category"::text
    WHEN 'LOGIN' THEN 'LOGIN'
    WHEN 'SCOUT' THEN 'SCOUT'
    WHEN 'RECRUIT' THEN 'SCOUT'
    WHEN 'PURCHASE' THEN 'SHOP_PURCHASE'
    WHEN 'PRODUCE' THEN 'PRODUCTION'
    WHEN 'TRAVEL' THEN 'TRAVEL'
    WHEN 'ATTACK' THEN 'ATTACK'
    WHEN 'MARKET' THEN 'MARKET_LISTING'
    WHEN 'SYSTEM' THEN 'SYSTEM'
    ELSE 'SYSTEM'
  END
)::"ActivityCategory_new";

DROP TYPE "ActivityCategory";

ALTER TYPE "ActivityCategory_new" RENAME TO "ActivityCategory";
