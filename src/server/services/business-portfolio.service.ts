import { prisma } from '@/lib/db/prisma';
import { runSerializableTransaction } from '@/lib/db/serializable-transaction';
import {
  buildPortfolioSummary,
  settleBusinessInTransaction,
  toBusinessViewModel,
} from '@/server/services/business.service';

/** Lightweight empire summary — settles all businesses then returns aggregates. */
export async function getBusinessEmpireSummary(playerId: string) {
  const player = await prisma.player.findUniqueOrThrow({ where: { id: playerId } });

  const settled = await runSerializableTransaction(async (tx) => {
    const rows = await tx.business.findMany({
      where: { playerId },
      include: { district: true },
      orderBy: { createdAt: 'asc' },
    });
    for (const row of rows) {
      await settleBusinessInTransaction(tx, row.id);
    }
    return tx.business.findMany({
      where: { playerId },
      include: { district: true },
      orderBy: { createdAt: 'asc' },
    });
  });

  const businesses = settled.map((b) => toBusinessViewModel(b, b.district.name));
  const summary = buildPortfolioSummary(player.prostitutes, businesses);

  return {
    owned: summary.ownedCount,
    assignedWorkers: summary.assignedWorkers,
    safeBalance: summary.totalSafeCash,
    overallHeat: summary.overallHeatBand,
  };
}
