import type { PlayerResources } from '@/config/game/balance';

export function playerToResources(player: {
  cash: number;
  prostitutes: number;
  thugs: number;
  rides: number;
  hash: number;
  shrooms: number;
  coke: number;
  heroin: number;
}): PlayerResources {
  return {
    cash: player.cash,
    prostitutes: player.prostitutes,
    thugs: player.thugs,
    rides: player.rides,
    hash: player.hash,
    shrooms: player.shrooms,
    coke: player.coke,
    heroin: player.heroin,
  };
}

export function snapshotPlayerState(player: Record<string, unknown>): Record<string, unknown> {
  const keys = [
    'cash', 'prostitutes', 'thugs', 'rides', 'glocks', 'uzis', 'aks',
    'beer', 'condoms', 'hash', 'shrooms', 'coke', 'heroin',
    'prostitutePayoutPercent', 'prostituteHappiness', 'thugHappiness',
  ];
  const snapshot: Record<string, unknown> = {};
  for (const key of keys) {
    if (key in player) snapshot[key] = player[key];
  }
  return snapshot;
}
