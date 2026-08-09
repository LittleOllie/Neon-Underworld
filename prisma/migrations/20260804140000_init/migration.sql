-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('PLAYER', 'ADMIN');

-- CreateEnum
CREATE TYPE "SeasonStatus" AS ENUM ('UPCOMING', 'ACTIVE', 'ENDED');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" "UserRole" NOT NULL DEFAULT 'PLAYER',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "lastLoginAt" TIMESTAMP(3),
    "bannedAt" TIMESTAMP(3),
    "banReason" TEXT,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Player" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "alias" TEXT NOT NULL,
    "aliasNormalized" TEXT NOT NULL,
    "districtId" TEXT NOT NULL,
    "seasonId" TEXT NOT NULL,
    "cash" INTEGER NOT NULL DEFAULT 0,
    "prostitutes" INTEGER NOT NULL DEFAULT 0,
    "thugs" INTEGER NOT NULL DEFAULT 0,
    "rides" INTEGER NOT NULL DEFAULT 0,
    "glocks" INTEGER NOT NULL DEFAULT 0,
    "uzis" INTEGER NOT NULL DEFAULT 0,
    "aks" INTEGER NOT NULL DEFAULT 0,
    "beer" INTEGER NOT NULL DEFAULT 0,
    "condoms" INTEGER NOT NULL DEFAULT 0,
    "hash" INTEGER NOT NULL DEFAULT 0,
    "shrooms" INTEGER NOT NULL DEFAULT 0,
    "coke" INTEGER NOT NULL DEFAULT 0,
    "heroin" INTEGER NOT NULL DEFAULT 0,
    "prostitutePayoutPercent" INTEGER NOT NULL DEFAULT 50,
    "prostituteHappiness" INTEGER NOT NULL DEFAULT 70,
    "thugHappiness" INTEGER NOT NULL DEFAULT 70,
    "isSystemPlayer" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Player_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlayerTurnState" (
    "id" TEXT NOT NULL,
    "playerId" TEXT NOT NULL,
    "currentTurns" INTEGER NOT NULL DEFAULT 0,
    "lastRegeneratedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "turnCap" INTEGER NOT NULL DEFAULT 12000,
    "regenerationRate" DOUBLE PRECISION NOT NULL DEFAULT 0.013888888888888888,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PlayerTurnState_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "District" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "modifiers" JSONB NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "District_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Season" (
    "id" TEXT NOT NULL,
    "number" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "status" "SeasonStatus" NOT NULL DEFAULT 'ACTIVE',
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Season_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InviteCode" (
    "id" TEXT NOT NULL,
    "codeHash" TEXT NOT NULL,
    "label" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "expiresAt" TIMESTAMP(3),
    "maximumUses" INTEGER NOT NULL DEFAULT 1,
    "currentUses" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InviteCode_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InviteCodeUse" (
    "id" TEXT NOT NULL,
    "inviteCodeId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "usedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InviteCodeUse_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GameAction" (
    "id" TEXT NOT NULL,
    "playerId" TEXT NOT NULL,
    "seasonId" TEXT NOT NULL,
    "actionType" TEXT NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "requestPayload" JSONB NOT NULL,
    "resultPayload" JSONB,
    "turnsSpent" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GameAction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EconomicAuditLog" (
    "id" TEXT NOT NULL,
    "playerId" TEXT,
    "userId" TEXT,
    "eventType" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "beforeState" JSONB NOT NULL,
    "delta" JSONB NOT NULL,
    "afterState" JSONB NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EconomicAuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ScoutResult" (
    "id" TEXT NOT NULL,
    "playerId" TEXT NOT NULL,
    "districtId" TEXT NOT NULL,
    "turnsSpent" INTEGER NOT NULL,
    "prostitutesFound" INTEGER NOT NULL,
    "thugsFound" INTEGER NOT NULL,
    "cashEarned" INTEGER NOT NULL,
    "prostitutesLost" INTEGER NOT NULL DEFAULT 0,
    "thugsLost" INTEGER NOT NULL DEFAULT 0,
    "cartelCashContribution" INTEGER NOT NULL DEFAULT 0,
    "cartelDrugContribution" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ScoutResult_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RankSnapshot" (
    "id" TEXT NOT NULL,
    "playerId" TEXT NOT NULL,
    "seasonId" TEXT NOT NULL,
    "netWorth" INTEGER NOT NULL,
    "rank" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RankSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GameConfigOverride" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "value" JSONB NOT NULL,
    "description" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GameConfigOverride_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdminAuditLog" (
    "id" TEXT NOT NULL,
    "adminUserId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "targetType" TEXT,
    "targetId" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AdminAuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "User_email_idx" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Player_userId_key" ON "Player"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Player_alias_key" ON "Player"("alias");

-- CreateIndex
CREATE UNIQUE INDEX "Player_aliasNormalized_key" ON "Player"("aliasNormalized");

-- CreateIndex
CREATE INDEX "Player_aliasNormalized_idx" ON "Player"("aliasNormalized");

-- CreateIndex
CREATE INDEX "Player_seasonId_cash_idx" ON "Player"("seasonId", "cash");

-- CreateIndex
CREATE INDEX "Player_seasonId_idx" ON "Player"("seasonId");

-- CreateIndex
CREATE UNIQUE INDEX "PlayerTurnState_playerId_key" ON "PlayerTurnState"("playerId");

-- CreateIndex
CREATE UNIQUE INDEX "District_slug_key" ON "District"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "Season_number_key" ON "Season"("number");

-- CreateIndex
CREATE UNIQUE INDEX "InviteCode_codeHash_key" ON "InviteCode"("codeHash");

-- CreateIndex
CREATE UNIQUE INDEX "InviteCodeUse_inviteCodeId_userId_key" ON "InviteCodeUse"("inviteCodeId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "GameAction_playerId_idempotencyKey_key" ON "GameAction"("playerId", "idempotencyKey");

-- CreateIndex
CREATE INDEX "GameAction_playerId_createdAt_idx" ON "GameAction"("playerId", "createdAt");

-- CreateIndex
CREATE INDEX "EconomicAuditLog_playerId_createdAt_idx" ON "EconomicAuditLog"("playerId", "createdAt");

-- CreateIndex
CREATE INDEX "ScoutResult_playerId_createdAt_idx" ON "ScoutResult"("playerId", "createdAt");

-- CreateIndex
CREATE INDEX "RankSnapshot_seasonId_netWorth_idx" ON "RankSnapshot"("seasonId", "netWorth");

-- CreateIndex
CREATE INDEX "RankSnapshot_playerId_createdAt_idx" ON "RankSnapshot"("playerId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "GameConfigOverride_key_key" ON "GameConfigOverride"("key");

-- CreateIndex
CREATE INDEX "AdminAuditLog_adminUserId_createdAt_idx" ON "AdminAuditLog"("adminUserId", "createdAt");

-- AddForeignKey
ALTER TABLE "Player" ADD CONSTRAINT "Player_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Player" ADD CONSTRAINT "Player_districtId_fkey" FOREIGN KEY ("districtId") REFERENCES "District"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Player" ADD CONSTRAINT "Player_seasonId_fkey" FOREIGN KEY ("seasonId") REFERENCES "Season"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlayerTurnState" ADD CONSTRAINT "PlayerTurnState_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InviteCodeUse" ADD CONSTRAINT "InviteCodeUse_inviteCodeId_fkey" FOREIGN KEY ("inviteCodeId") REFERENCES "InviteCode"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InviteCodeUse" ADD CONSTRAINT "InviteCodeUse_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GameAction" ADD CONSTRAINT "GameAction_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GameAction" ADD CONSTRAINT "GameAction_seasonId_fkey" FOREIGN KEY ("seasonId") REFERENCES "Season"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EconomicAuditLog" ADD CONSTRAINT "EconomicAuditLog_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EconomicAuditLog" ADD CONSTRAINT "EconomicAuditLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScoutResult" ADD CONSTRAINT "ScoutResult_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScoutResult" ADD CONSTRAINT "ScoutResult_districtId_fkey" FOREIGN KEY ("districtId") REFERENCES "District"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RankSnapshot" ADD CONSTRAINT "RankSnapshot_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RankSnapshot" ADD CONSTRAINT "RankSnapshot_seasonId_fkey" FOREIGN KEY ("seasonId") REFERENCES "Season"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
