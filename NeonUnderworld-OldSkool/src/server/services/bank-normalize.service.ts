import { prisma } from '@core/lib/db/prisma';
import { runSerializableTransaction } from '@core/lib/db/serializable-transaction';

/**
 * Bank is hidden from the player UI. Move stored bank balance to cash in a single
 * atomic transaction so money is never trapped. Net worth is unchanged.
 */
export async function normalizeHiddenBankBalance(playerId: string): Promise<number> {
  return runSerializableTransaction(async (tx) => {
    const player = await tx.player.findUnique({ where: { id: playerId } });
    if (!player || player.bankCash <= 0) return 0;

    const amount = player.bankCash;
    const updated = await tx.player.updateMany({
      where: { id: playerId, bankCash: { gte: amount } },
      data: {
        cash: { increment: amount },
        bankCash: 0,
      },
    });
    return updated.count > 0 ? amount : 0;
  });
}

/** One-time / maintenance sweep for all players with legacy bankCash. */
export async function normalizeAllHiddenBankBalances(): Promise<number> {
  const players = await prisma.player.findMany({
    where: { bankCash: { gt: 0 } },
    select: { id: true },
  });

  let total = 0;
  for (const { id } of players) {
    total += await normalizeHiddenBankBalance(id);
  }
  return total;
}
