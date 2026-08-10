-- CreateEnum
CREATE TYPE "CartelInviteStatus" AS ENUM ('PENDING', 'ACCEPTED', 'DECLINED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "MarketListingStatus" AS ENUM ('ACTIVE', 'SETTLED', 'EXPIRED', 'CANCELLED');

-- AlterTable
ALTER TABLE "Player" ADD COLUMN "cartelDonationPercent" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "Cartel" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "tag" TEXT NOT NULL,
    "leaderId" TEXT NOT NULL,
    "treasuryCash" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Cartel_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CartelInvite" (
    "id" TEXT NOT NULL,
    "cartelId" TEXT NOT NULL,
    "inviterId" TEXT NOT NULL,
    "inviteeId" TEXT NOT NULL,
    "status" "CartelInviteStatus" NOT NULL DEFAULT 'PENDING',
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CartelInvite_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MarketListing" (
    "id" TEXT NOT NULL,
    "sellerId" TEXT NOT NULL,
    "itemKey" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "startingPrice" INTEGER NOT NULL,
    "currentBid" INTEGER,
    "highestBidderId" TEXT,
    "endsAt" TIMESTAMP(3) NOT NULL,
    "status" "MarketListingStatus" NOT NULL DEFAULT 'ACTIVE',
    "settledAt" TIMESTAMP(3),
    "settlementKey" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MarketListing_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MarketBid" (
    "id" TEXT NOT NULL,
    "listingId" TEXT NOT NULL,
    "bidderId" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MarketBid_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Cartel_name_key" ON "Cartel"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Cartel_tag_key" ON "Cartel"("tag");

-- CreateIndex
CREATE INDEX "Cartel_leaderId_idx" ON "Cartel"("leaderId");

-- CreateIndex
CREATE INDEX "CartelInvite_inviteeId_status_idx" ON "CartelInvite"("inviteeId", "status");

-- CreateIndex
CREATE INDEX "CartelInvite_cartelId_status_idx" ON "CartelInvite"("cartelId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "MarketListing_settlementKey_key" ON "MarketListing"("settlementKey");

-- CreateIndex
CREATE INDEX "MarketListing_status_endsAt_idx" ON "MarketListing"("status", "endsAt");

-- CreateIndex
CREATE INDEX "MarketListing_sellerId_status_idx" ON "MarketListing"("sellerId", "status");

-- CreateIndex
CREATE INDEX "MarketListing_itemKey_status_idx" ON "MarketListing"("itemKey", "status");

-- CreateIndex
CREATE UNIQUE INDEX "MarketBid_bidderId_idempotencyKey_key" ON "MarketBid"("bidderId", "idempotencyKey");

-- CreateIndex
CREATE INDEX "MarketBid_listingId_createdAt_idx" ON "MarketBid"("listingId", "createdAt");

-- CreateIndex
CREATE INDEX "Player_cartelId_idx" ON "Player"("cartelId");

-- AddForeignKey
ALTER TABLE "Player" ADD CONSTRAINT "Player_cartelId_fkey" FOREIGN KEY ("cartelId") REFERENCES "Cartel"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CartelInvite" ADD CONSTRAINT "CartelInvite_cartelId_fkey" FOREIGN KEY ("cartelId") REFERENCES "Cartel"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CartelInvite" ADD CONSTRAINT "CartelInvite_inviterId_fkey" FOREIGN KEY ("inviterId") REFERENCES "Player"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CartelInvite" ADD CONSTRAINT "CartelInvite_inviteeId_fkey" FOREIGN KEY ("inviteeId") REFERENCES "Player"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarketListing" ADD CONSTRAINT "MarketListing_sellerId_fkey" FOREIGN KEY ("sellerId") REFERENCES "Player"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarketListing" ADD CONSTRAINT "MarketListing_highestBidderId_fkey" FOREIGN KEY ("highestBidderId") REFERENCES "Player"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarketBid" ADD CONSTRAINT "MarketBid_listingId_fkey" FOREIGN KEY ("listingId") REFERENCES "MarketListing"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarketBid" ADD CONSTRAINT "MarketBid_bidderId_fkey" FOREIGN KEY ("bidderId") REFERENCES "Player"("id") ON DELETE CASCADE ON UPDATE CASCADE;
