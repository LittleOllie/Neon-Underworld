import { prisma } from '@core/lib/db/prisma';

/**
 * Bank is hidden from the player UI. Move any stored bank balance to cash
 * so money is never trapped. Net worth is unchanged (cash + bankCash total preserved).
 */
export async function normalizeHiddenBankBalance(playerId: string): Promise<number> {
  const player = await prisma.player.findUnique({ where: { id: playerId } });
  if (!player || player.bankCash <= 0) return 0;

  const amount = player.bankCash;
  await prisma.player.update({
    where: { id: playerId },
    data: {
      cash: { increment: amount },
      bankCash: 0,
    },
  });
  return amount;
}
