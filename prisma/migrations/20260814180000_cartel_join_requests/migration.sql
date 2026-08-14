-- CreateEnum
CREATE TYPE "CartelJoinRequestStatus" AS ENUM ('PENDING', 'ACCEPTED', 'DECLINED', 'CANCELLED');

-- CreateTable
CREATE TABLE "CartelJoinRequest" (
    "id" TEXT NOT NULL,
    "cartelId" TEXT NOT NULL,
    "applicantId" TEXT NOT NULL,
    "status" "CartelJoinRequestStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CartelJoinRequest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CartelJoinRequest_cartelId_status_idx" ON "CartelJoinRequest"("cartelId", "status");

-- CreateIndex
CREATE INDEX "CartelJoinRequest_applicantId_status_idx" ON "CartelJoinRequest"("applicantId", "status");

-- AddForeignKey
ALTER TABLE "CartelJoinRequest" ADD CONSTRAINT "CartelJoinRequest_cartelId_fkey" FOREIGN KEY ("cartelId") REFERENCES "Cartel"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CartelJoinRequest" ADD CONSTRAINT "CartelJoinRequest_applicantId_fkey" FOREIGN KEY ("applicantId") REFERENCES "Player"("id") ON DELETE CASCADE ON UPDATE CASCADE;
