import type { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db/prisma';
import {
  aggregateBusinessNwContext,
  BUSINESS_NW_SELECT,
  type BusinessNwSelect,
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

export async function loadBusinessNwRowsForPlayers(
  playerIds: string[],
): Promise<Map<string, BusinessNwSelect[]>> {
  const map = new Map<string, BusinessNwSelect[]>();
  for (const id of playerIds) {
    map.set(id, []);
  }
  if (playerIds.length === 0) return map;

  const rows = await prisma.business.findMany({
    where: { playerId: { in: playerIds } },
    select: { playerId: true, ...BUSINESS_NW_SELECT },
  });

  for (const row of rows) {
    const { playerId, ...business } = row;
    const list = map.get(playerId) ?? [];
    list.push(business);
    map.set(playerId, list);
  }

  return map;
}

export async function loadBusinessNwRowsInTx(
  tx: Prisma.TransactionClient,
  playerIds: string[],
): Promise<Map<string, BusinessNwSelect[]>> {
  const map = new Map<string, BusinessNwSelect[]>();
  for (const id of playerIds) {
    map.set(id, []);
  }
  if (playerIds.length === 0) return map;

  const rows = await tx.business.findMany({
    where: { playerId: { in: playerIds } },
    select: { playerId: true, ...BUSINESS_NW_SELECT },
  });

  for (const row of rows) {
    const { playerId, ...business } = row;
    const list = map.get(playerId) ?? [];
    list.push(business);
    map.set(playerId, list);
  }

  return map;
}

export function calculatePlayerCanonicalNetWorthWithBusinesses(
  player: CanonicalNetWorthPlayerRecord,
  businesses: BusinessNwSelect[],
): number {
  return calculatePlayerCanonicalNetWorthSync(player, businesses);
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

export async function calculatePlayersCanonicalNetWorthMap(
  players: Array<CanonicalNetWorthPlayerRecord & { id: string }>,
): Promise<Map<string, number>> {
  if (players.length === 0) return new Map();

  const playerIds = players.map((p) => p.id);
  const byPlayer = await loadBusinessNwRowsForPlayers(playerIds);
  const map = new Map<string, number>();

  for (const player of players) {
    const businesses = byPlayer.get(player.id) ?? [];
    map.set(player.id, calculatePlayerCanonicalNetWorthWithBusinesses(player, businesses));
  }

  return map;
}

export function calculatePlayersCanonicalNetWorthMapSync(
  players: Array<CanonicalNetWorthPlayerRecord & { id: string }>,
  businessesByPlayer: Map<string, BusinessNwSelect[]>,
): Map<string, number> {
  const map = new Map<string, number>();
  for (const player of players) {
    const businesses = businessesByPlayer.get(player.id) ?? [];
    map.set(player.id, calculatePlayerCanonicalNetWorthWithBusinesses(player, businesses));
  }
  return map;
}

export type { BusinessRecord } from '@/server/services/business.service';
