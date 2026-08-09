import { describe, it, expect } from 'vitest';
import { NetWorthService } from '@local/server/services/net-worth.service';
import { calculateCanonicalNetWorthFromPlayer } from '@core/lib/game-engine/canonical-net-worth';

describe('NetWorthService — canonical consistency', () => {
  const player = {
    id: 'p1',
    cash: 12_000,
    bankCash: 3_000,
    thugs: 8,
    prostitutes: 6,
    rides: 3,
    glocks: 2,
    uzis: 1,
    aks: 0,
    hash: 50,
    shrooms: 20,
    coke: 10,
    heroin: 5,
    businesses: 2,
  };

  it('matches core canonical calculator for same player snapshot', () => {
    const fromService = NetWorthService.calculateFromPlayer(player);
    const fromCore = calculateCanonicalNetWorthFromPlayer(player);
    expect(fromService).toBe(fromCore);
  });

  it('rankings batch matches per-player calculation', () => {
    const batch = NetWorthService.calculateForPlayers([player]);
    expect(batch.get(player.id)).toBe(NetWorthService.calculateFromPlayer(player));
  });
});
