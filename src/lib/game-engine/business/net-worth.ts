import { prisma } from '@/lib/db/prisma';
import {
  aggregateBusinessNwContext,
  type BusinessRecord,
} from '@/server/services/business.service';
import {
  calculateCanonicalNetWorthFromPlayer,
  type CanonicalNetWorthBusinessContext,
  type CanonicalNetWorthPlayerRecord,
} from '@/lib/game-engine/canonical-net-worth';

export async function loadBusinessNwContext(
  playerId: string,
): Promise<Omit<CanonicalNetWorthBusinessContext, 'streetWorkers'>> {
  const businesses = await prisma.business.findMany({
    where: { playerId },
    select: { purchasePrice: true, assignedWorkers: true },
  });
  return aggregateBusinessNwContext(businesses);
}

export async function calculatePlayerCanonicalNetWorth(
  player: CanonicalNetWorthPlayerRecord & { id: string },
): Promise<number> {
  const ctx = await loadBusinessNwContext(player.id);
  return calculateCanonicalNetWorthFromPlayer(player, {
    streetWorkers: player.prostitutes,
    assignedWorkers: ctx.assignedWorkers,
    businessStreetAssets: ctx.businessStreetAssets,
  });
}

export function calculatePlayerCanonicalNetWorthSync(
  player: CanonicalNetWorthPlayerRecord,
  businesses: Pick<BusinessRecord, 'purchasePrice' | 'assignedWorkers'>[],
): number {
  const ctx = aggregateBusinessNwContext(businesses);
  return calculateCanonicalNetWorthFromPlayer(player, {
    streetWorkers: player.prostitutes,
    assignedWorkers: ctx.assignedWorkers,
    businessStreetAssets: ctx.businessStreetAssets,
  });
}
