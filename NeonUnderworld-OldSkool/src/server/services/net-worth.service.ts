import { prisma } from '@core/lib/db/prisma';
import {
  aggregateBusinessNwContext,
  BUSINESS_NW_SELECT,
  type BusinessNwSelect,
} from '@core/server/services/business.service';
import {
  calculateCanonicalNetWorth,
  calculateCanonicalNetWorthFromPlayer,
  type CanonicalNetWorthBusinessContext,
  type CanonicalNetWorthInput,
} from '@core/lib/game-engine/canonical-net-worth';
import { loadBusinessNwContext } from '@core/lib/game-engine/business/net-worth';
import { EmpireService } from './empire.service';

export type { CanonicalNetWorthInput as NetWorthInput };

export type PlayerNetWorthRecord = {
  id: string;
  cash: number;
  bankCash: number;
  prostitutes: number;
  thugs: number;
  rides: number;
  glocks: number;
  uzis: number;
  aks: number;
  hash: number;
  shrooms: number;
  coke: number;
  heroin: number;
  businesses: number;
};

function toNetWorthInput(
  player: PlayerNetWorthRecord,
  businessContext?: Omit<CanonicalNetWorthBusinessContext, 'streetWorkers'>,
): CanonicalNetWorthInput {
  const empire = EmpireService.aggregateFromPlayer(player);
  return {
    cash: player.cash,
    bankCash: player.bankCash,
    thugs: empire.thugs + (businessContext?.assignedSecurityThugs ?? 0),
    workers: player.prostitutes + (businessContext?.assignedWorkers ?? 0),
    vehicles: empire.vehicles,
    drugs: empire.drugs,
    businessStreetAssets: businessContext?.businessStreetAssets ?? 0,
  };
}

async function businessContextForPlayer(
  player: PlayerNetWorthRecord,
): Promise<Omit<CanonicalNetWorthBusinessContext, 'streetWorkers'>> {
  return loadBusinessNwContext(player.id);
}

/** Authoritative net-worth service — all rankings, header, attack eligibility use this. */
export const NetWorthService = {
  calculate(input: CanonicalNetWorthInput): number {
    return calculateCanonicalNetWorth(input);
  },

  calculateFromPlayer(
    player: PlayerNetWorthRecord,
    businessContext?: Omit<CanonicalNetWorthBusinessContext, 'streetWorkers'>,
  ): number {
    if (businessContext) {
      return calculateCanonicalNetWorthFromPlayer(player, {
        streetWorkers: player.prostitutes,
        assignedWorkers: businessContext.assignedWorkers,
        assignedSecurityThugs: businessContext.assignedSecurityThugs,
        businessStreetAssets: businessContext.businessStreetAssets,
      });
    }
    return calculateCanonicalNetWorthFromPlayer(player);
  },

  async calculateFromPlayerAsync(player: PlayerNetWorthRecord): Promise<number> {
    try {
      const ctx = await businessContextForPlayer(player);
      return this.calculateFromPlayer(player, ctx);
    } catch {
      return this.calculateFromPlayer(player);
    }
  },

  async calculateForPlayers(players: PlayerNetWorthRecord[]): Promise<Map<string, number>> {
    if (players.length === 0) return new Map();

    const playerIds = players.map((p) => p.id);
    let allBusinesses: Array<{ playerId: string } & BusinessNwSelect> = [];

    try {
      allBusinesses = await prisma.business.findMany({
        where: { playerId: { in: playerIds } },
        select: { playerId: true, ...BUSINESS_NW_SELECT },
      });
    } catch {
      const map = new Map<string, number>();
      for (const player of players) {
        map.set(player.id, this.calculateFromPlayer(player));
      }
      return map;
    }

    const byPlayer = new Map<string, typeof allBusinesses>();
    for (const row of allBusinesses) {
      const list = byPlayer.get(row.playerId) ?? [];
      list.push(row);
      byPlayer.set(row.playerId, list);
    }

    const map = new Map<string, number>();
    for (const player of players) {
      const rows = byPlayer.get(player.id) ?? [];
      const ctx = aggregateBusinessNwContext(rows);
      map.set(
        player.id,
        calculateCanonicalNetWorthFromPlayer(player, {
          streetWorkers: player.prostitutes,
          assignedWorkers: ctx.assignedWorkers,
          assignedSecurityThugs: ctx.assignedSecurityThugs,
          businessStreetAssets: ctx.businessStreetAssets,
        }),
      );
    }
    return map;
  },

  toInput(
    player: PlayerNetWorthRecord,
    businessContext?: Omit<CanonicalNetWorthBusinessContext, 'streetWorkers'>,
  ): CanonicalNetWorthInput {
    return toNetWorthInput(player, businessContext);
  },
};
