-- Cartel armoury — shared thugs and weapons purchased from treasury
ALTER TABLE "Cartel" ADD COLUMN "thugs" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Cartel" ADD COLUMN "glocks" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Cartel" ADD COLUMN "uzis" INTEGER NOT NULL DEFAULT 0;
