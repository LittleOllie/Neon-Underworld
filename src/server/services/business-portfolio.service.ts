import { prisma } from '@/lib/db/prisma';
import { runSerializableTransaction } from '@/lib/db/serializable-transaction';
import {
  buildPortfolioSummary,
  settleBusinessInTransaction,
  toBusinessViewModel,
} from '@/server/services/business.service';
import { MAX_BUSINESSES_PER_PLAYER } from '@/config/game/business-rules';

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
  const overallHeatScore =
    businesses.length > 0 ? Math.max(...businesses.map((b) => b.heatScore)) : 0;

  const safeFullSites = businesses
    .filter((b) => b.safeFull)
    .map((b) => ({
      id: b.id,
      name: b.name,
      safeCash: b.safeCash,
      safeCapacity: b.safeCapacity,
    }));

  const criticalHeatSites = businesses
    .filter((b) => b.heatBand === 'CRITICAL')
    .map((b) => ({ id: b.id, name: b.name }));

  const overCapacityCount = businesses.filter(
    (b) => b.workerOverCapacity || b.securityOverCapacity,
  ).length;

  const assignedSecurityThugs = businesses.reduce((sum, b) => sum + b.assignedThugs, 0);
  const totalStoredDrugs = businesses.reduce((sum, b) => sum + b.storedDrugUnits, 0);

  return {
    owned: summary.ownedCount,
    maxOwned: MAX_BUSINESSES_PER_PLAYER,
    assignedWorkers: summary.assignedWorkers,
    assignedSecurityThugs,
    safeBalance: summary.totalSafeCash,
    totalStoredDrugs,
    safeFullCount: safeFullSites.length,
    safeFullSites,
    overCapacityCount,
    criticalHeatCount: criticalHeatSites.length,
    criticalHeatSites,
    overallHeat: summary.overallHeatBand,
    overallHeatScore,
    sites: businesses.map((b) => ({
      id: b.id,
      name: b.name,
      heatScore: b.heatScore,
      heatBand: b.heatBand,
      heatLabel: b.heatLabel,
      safeFull: b.safeFull,
    })),
  };
}
