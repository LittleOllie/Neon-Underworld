-- Businesses V1.1: levels + security thugs
ALTER TABLE "Business" ADD COLUMN "level" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "Business" ADD COLUMN "assignedThugs" INTEGER NOT NULL DEFAULT 0;
