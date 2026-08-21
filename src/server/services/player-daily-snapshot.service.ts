import type { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db/prisma';
import { getSeasonRoundDay } from '@/lib/game-engine/npc-progression/round-age';
import { isHumanPlayer } from '@/lib/game-engine/human-player';

type Tx = Prisma.TransactionClient;

type SnapshotInput = {
  playerId: string;
  seasonId: string;
  seasonStartsAt: Date;
  seasonEndsAt: Date;
  netWorth: number;
  cash: number;
  bankCash: number;
  turns: number;
  workers: number;
  thugs: number;
  businesses: number;
  districtId: string;
  rank?: number | null;
};

export const PlayerDailySnapshotService = {
  async upsertForRoundDay(input: SnapshotInput, tx: Tx = prisma): Promise<void> {
    const player = await tx.player.findUnique({
      where: { id: input.playerId },
      select: { isSystemPlayer: true, seasonActivatedAt: true, user: { select: { email: true } } },
    });
    if (
      !player?.seasonActivatedAt ||
      !isHumanPlayer({ isSystemPlayer: player.isSystemPlayer, email: player.user?.email })
    ) {
      return;
    }

    const roundDay = getSeasonRoundDay(input.seasonStartsAt, input.seasonEndsAt);

    await tx.playerDailySnapshot.upsert({
      where: {
        seasonId_playerId_roundDay: {
          seasonId: input.seasonId,
          playerId: input.playerId,
          roundDay,
        },
      },
      create: {
        seasonId: input.seasonId,
        playerId: input.playerId,
        roundDay,
        netWorth: input.netWorth,
        cash: input.cash,
        bankCash: input.bankCash,
        turns: input.turns,
        workers: input.workers,
        thugs: input.thugs,
        businesses: input.businesses,
        districtId: input.districtId,
        rank: input.rank ?? null,
      },
      update: {
        netWorth: input.netWorth,
        cash: input.cash,
        bankCash: input.bankCash,
        turns: input.turns,
        workers: input.workers,
        thugs: input.thugs,
        businesses: input.businesses,
        districtId: input.districtId,
        rank: input.rank ?? null,
      },
    });
  },
};
