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
import {
  calculatePlayerCanonicalNetWorthWithBusinesses,
  calculatePlayersCanonicalNetWorthMap,
  loadBusinessNwContext,
} from '@core/lib/game-engine/business/net-worth';
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

/** Authoritative net-worth service — rankings, header, combat, intel, profiles. */
export const NetWorthService = {
  calculate(input: CanonicalNetWorthInput): number {
    return calculateCanonicalNetWorth(input);
  },

  /** Business-aware when context supplied; otherwise street-only (avoid for gameplay paths). */
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

  /** Preferred single-player NW — loads business context from DB. */
  async calculateFromPlayerAsync(player: PlayerNetWorthRecord): Promise<number> {
    const ctx = await loadBusinessNwContext(player.id);
    return this.calculateFromPlayer(player, ctx);
  },

  /** Batch NW for rankings and attack target lists — same formula as async single-player. */
  async calculateForPlayers(players: PlayerNetWorthRecord[]): Promise<Map<string, number>> {
    return calculatePlayersCanonicalNetWorthMap(players);
  },

  toInput(
    player: PlayerNetWorthRecord,
    businessContext?: Omit<CanonicalNetWorthBusinessContext, 'streetWorkers'>,
  ): CanonicalNetWorthInput {
    return toNetWorthInput(player, businessContext);
  },

  calculateWithBusinessRows(
    player: PlayerNetWorthRecord,
    businesses: BusinessNwSelect[],
  ): number {
    return calculatePlayerCanonicalNetWorthWithBusinesses(player, businesses);
  },

  aggregateBusinessNwContext,
  BUSINESS_NW_SELECT,
};
