import { prisma } from '@/lib/db/prisma';
import {
  aggregateBusinessNwContext,
  BUSINESS_NW_SELECT,
  type BusinessNwSelect,
  type BusinessRecord,
} from '@/server/services/business.service';
import {
  calculateCanonicalNetWorthFromPlayer,
  type CanonicalNetWorthPlayerRecord,
} from '@/lib/game-engine/canonical-net-worth';

export { BUSINESS_NW_SELECT };

export async function loadBusinessNwContext(
  playerId: string,
): Promise<ReturnType<typeof aggregateBusinessNwContext>> {
  const businesses = await prisma.business.findMany({
    where: { playerId },
    select: BUSINESS_NW_SELECT,
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
    assignedSecurityThugs: ctx.assignedSecurityThugs,
    businessStreetAssets: ctx.businessStreetAssets,
  });
}

export function calculatePlayerCanonicalNetWorthSync(
  player: CanonicalNetWorthPlayerRecord,
  businesses: BusinessNwSelect[],
): number {
  const ctx = aggregateBusinessNwContext(businesses);
  return calculateCanonicalNetWorthFromPlayer(player, {
    streetWorkers: player.prostitutes,
    assignedWorkers: ctx.assignedWorkers,
    assignedSecurityThugs: ctx.assignedSecurityThugs,
    businessStreetAssets: ctx.businessStreetAssets,
  });
}

export type { BusinessRecord };
