import type { Business } from '@prisma/client';
import { prisma } from '@/lib/db/prisma';
import { runSerializableTransaction } from '@/lib/db/serializable-transaction';
import {
  buildPortfolioSummary,
  settleBusinessInTransaction,
  settleBusinessState,
  toBusinessViewModel,
} from '@/server/services/business.service';
import { MAX_BUSINESSES_PER_PLAYER } from '@/config/game/business-rules';

export type BusinessEmpireSummaryOptions = {
  /** Persist settlement in DB. Default false — read-only projection for nav-heavy pages. */
  settle?: boolean;
};

type BusinessRowWithDistrict = Business & { district: { name: string } };

function projectBusinessRow(row: Business, now: Date = new Date()): Business {
  const settlement = settleBusinessState(row, now);
  return {
    ...row,
    safeCash: settlement.safeCash,
    hash: settlement.hash,
    shrooms: settlement.shrooms,
    coke: settlement.coke,
    heroin: settlement.heroin,
    lastSettledAt: settlement.lastSettledAt,
    lastRaidCheckAt: settlement.lastRaidCheckAt,
  };
}

function buildEmpireSummaryFromRows(
  player: { prostitutes: number },
  rows: BusinessRowWithDistrict[],
  now: Date = new Date(),
) {
  const businesses = rows.map((b) => toBusinessViewModel(b, b.district.name, now));
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

/** Lightweight empire summary — read-only by default; optional persist settle for mutations. */
export async function getBusinessEmpireSummary(
  playerId: string,
  options: BusinessEmpireSummaryOptions = {},
) {
  const player = await prisma.player.findUniqueOrThrow({ where: { id: playerId } });
  const now = new Date();

  if (options.settle) {
    const settled = await runSerializableTransaction(async (tx) => {
      const rows = await tx.business.findMany({
        where: { playerId },
        include: { district: true },
        orderBy: { createdAt: 'asc' },
      });
      for (const row of rows) {
        await settleBusinessInTransaction(tx, row.id, now);
      }
      return tx.business.findMany({
        where: { playerId },
        include: { district: true },
        orderBy: { createdAt: 'asc' },
      });
    });

    return buildEmpireSummaryFromRows(player, settled, now);
  }

  const rows = await prisma.business.findMany({
    where: { playerId },
    include: { district: true },
    orderBy: { createdAt: 'asc' },
  });

  const projected = rows.map((row) => ({
    ...row,
    ...projectBusinessRow(row, now),
    district: row.district,
  }));

  return buildEmpireSummaryFromRows(player, projected, now);
}
