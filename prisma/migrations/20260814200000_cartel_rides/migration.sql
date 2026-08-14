-- Cartel-owned transport for Response Force deployment (5 thugs per ride).
ALTER TABLE "Cartel" ADD COLUMN "rides" INTEGER NOT NULL DEFAULT 0;
