import {
  calculateCanonicalNetWorth,
  calculateCanonicalNetWorthFromPlayer,
  type CanonicalNetWorthInput,
} from '@core/lib/game-engine/canonical-net-worth';
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

function toNetWorthInput(player: PlayerNetWorthRecord): CanonicalNetWorthInput {
  const empire = EmpireService.aggregateFromPlayer(player);
  return {
    cash: player.cash,
    bankCash: player.bankCash,
    thugs: empire.thugs,
    workers: empire.workers,
    vehicles: empire.vehicles,
    drugs: empire.drugs,
  };
}

/** Authoritative net-worth service — all rankings, header, attack eligibility use this. */
export const NetWorthService = {
  calculate(input: CanonicalNetWorthInput): number {
    return calculateCanonicalNetWorth(input);
  },

  calculateFromPlayer(player: PlayerNetWorthRecord): number {
    return calculateCanonicalNetWorthFromPlayer(player);
  },

  calculateForPlayers(players: PlayerNetWorthRecord[]): Map<string, number> {
    const map = new Map<string, number>();
    for (const p of players) {
      map.set(p.id, calculateCanonicalNetWorthFromPlayer(p));
    }
    return map;
  },

  toInput(player: PlayerNetWorthRecord): CanonicalNetWorthInput {
    return toNetWorthInput(player);
  },
};
