import { describe, it, expect } from 'vitest';
import { NetWorthService, type PlayerNetWorthRecord } from '@local/server/services/net-worth.service';
import { NET_WORTH_VALUATIONS } from '@local/config/valuations';
import { workersLabel, OS_TERMS } from '@local/config/terminology';

function samplePlayer(overrides: Partial<PlayerNetWorthRecord> = {}): PlayerNetWorthRecord {
  return {
    id: 'p1',
    cash: 10000,
    bankCash: 5000,
    prostitutes: 7,
    thugs: 2,
    rides: 1,
    glocks: 5,
    uzis: 0,
    aks: 0,
    hash: 10,
    shrooms: 5,
    coke: 3,
    heroin: 2,
    businesses: 1,
    ...overrides,
  };
}

describe('NetWorthService batch calculation', () => {
  it('calculateForPlayers matches single-player calculation', async () => {
    const players = [samplePlayer({ id: 'a' }), samplePlayer({ id: 'b', cash: 20000 })];
    const batch = await NetWorthService.calculateForPlayers(players);
    for (const p of players) {
      expect(batch.get(p.id)).toBe(NetWorthService.calculateFromPlayer(p));
    }
  });

  it('includes bank cash, excludes businesses and weapons', () => {
    const p = samplePlayer();
    const nw = NetWorthService.calculateFromPlayer(p);
    const drugs = p.hash + p.shrooms + p.coke + p.heroin;
    const expected =
      p.cash +
      p.bankCash +
      p.thugs * NET_WORTH_VALUATIONS.thug +
      p.prostitutes * NET_WORTH_VALUATIONS.worker +
      p.rides * NET_WORTH_VALUATIONS.vehicle +
      drugs * NET_WORTH_VALUATIONS.drugUnit;
    expect(nw).toBe(expected);
    expect(p.glocks).toBeGreaterThan(0);
  });
});

describe('Rankings tie-break order', () => {
  it('sorts net worth desc, then createdAt asc, then id asc', () => {
    const rows = [
      { netWorth: 1000, createdAt: new Date('2026-01-02'), id: 'b' },
      { netWorth: 1000, createdAt: new Date('2026-01-01'), id: 'a' },
      { netWorth: 2000, createdAt: new Date('2026-01-03'), id: 'c' },
    ];
    rows.sort((a, b) => {
      if (b.netWorth !== a.netWorth) return b.netWorth - a.netWorth;
      const created = a.createdAt.getTime() - b.createdAt.getTime();
      if (created !== 0) return created;
      return a.id.localeCompare(b.id);
    });
    expect(rows.map((r) => r.id)).toEqual(['c', 'a', 'b']);
  });
});

describe('Terminology', () => {
  it('maps prostitutes count label to Workers, never Prostitutes', () => {
    expect(workersLabel(1)).toBe(OS_TERMS.worker);
    expect(workersLabel(5)).toBe(OS_TERMS.workers);
    expect(workersLabel(5)).not.toContain('Prostitute');
    expect(OS_TERMS.workers).toBe('Workers');
  });
});

describe('PlayerStatusService last seen', () => {
  it('prefers statusExt lastSeen over updatedAt', async () => {
    const { PlayerStatusService } = await import('@local/server/services/player-status.service');
    const statusSeen = new Date('2026-06-01');
    const updatedAt = new Date('2026-01-01');
    const lastLogin = new Date('2026-03-01');
    expect(PlayerStatusService.resolveLastSeen(lastLogin, statusSeen, updatedAt)).toEqual(statusSeen);
  });

  it('falls back to lastLogin then updatedAt', async () => {
    const { PlayerStatusService } = await import('@local/server/services/player-status.service');
    const updatedAt = new Date('2026-01-01');
    const lastLogin = new Date('2026-03-01');
    expect(PlayerStatusService.resolveLastSeen(lastLogin, null, updatedAt)).toEqual(lastLogin);
    expect(PlayerStatusService.resolveLastSeen(null, null, updatedAt)).toEqual(updatedAt);
  });
});
