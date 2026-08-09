import {
  calculateCanonicalNetWorth,
  type NetWorthInput,
} from '@local/config/valuations';
import { EmpireService } from './empire.service';

export type { NetWorthInput };

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

function toNetWorthInput(player: PlayerNetWorthRecord): NetWorthInput {
  const empire = EmpireService.aggregateFromPlayer(player);
  return {
    cash: player.cash,
    bankCash: player.bankCash,
    thugs: empire.thugs,
    workers: empire.workers,
    vehicles: empire.vehicles,
    drugs: empire.drugs,
    businesses: empire.businesses,
  };
}

export const NetWorthService = {
  calculate(input: NetWorthInput): number {
    return calculateCanonicalNetWorth(input);
  },

  calculateFromPlayer(player: PlayerNetWorthRecord): number {
    return calculateCanonicalNetWorth(toNetWorthInput(player));
  },

  calculateForPlayers(players: PlayerNetWorthRecord[]): Map<string, number> {
    const map = new Map<string, number>();
    for (const p of players) {
      map.set(p.id, calculateCanonicalNetWorth(toNetWorthInput(p)));
    }
    return map;
  },

  toInput(player: PlayerNetWorthRecord): NetWorthInput {
    return toNetWorthInput(player);
  },
};
