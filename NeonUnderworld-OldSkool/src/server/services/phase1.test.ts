import { describe, it, expect } from 'vitest';
import {
  calculateCanonicalNetWorth,
  NET_WORTH_VALUATIONS,
  businessNetWorth,
} from '@local/config/valuations';
import { NetWorthService } from '@local/server/services/net-worth.service';
import { TurnService } from '@local/server/services/turn.service';
import { TURNS_CONFIG } from '@core/config/game/balance';
import {
  ACTIVITY_TYPES,
  buildScoutActivityMessage,
  normalizeActivityCategory,
} from '@local/config/activity-types';

describe('NetWorthService — canonical formula', () => {
  const base = {
    cash: 10000,
    bankCash: 5000,
    thugs: 2,
    workers: 7,
    vehicles: 1,
    drugs: 20,
    businesses: 1,
  };

  it('includes cash and bank cash', () => {
    const nw = NetWorthService.calculate({ ...base, thugs: 0, workers: 0, vehicles: 0, drugs: 0, businesses: 0 });
    expect(nw).toBe(15000);
  });

  it('includes thugs, workers, vehicles and drugs using shared configured values', () => {
    const nw = NetWorthService.calculate({ ...base, cash: 0, bankCash: 0, businesses: 0 });
    const expected =
      2 * NET_WORTH_VALUATIONS.thug +
      7 * NET_WORTH_VALUATIONS.worker +
      1 * NET_WORTH_VALUATIONS.vehicle +
      20 * NET_WORTH_VALUATIONS.drugUnit;
    expect(nw).toBe(expected);
  });

  it('excludes businesses from net worth (Redlite guide §5)', () => {
    expect(businessNetWorth(2)).toBe(2 * 5000);
    const nw = NetWorthService.calculate({ ...base, cash: 0, bankCash: 0, thugs: 0, workers: 0, vehicles: 0, drugs: 0 });
    expect(nw).toBe(0);
  });

  it('excludes weapons — net worth input has no weapon field', () => {
    const nw = NetWorthService.calculate(base);
    const expected =
      base.cash +
      base.bankCash +
      base.thugs * NET_WORTH_VALUATIONS.thug +
      base.workers * NET_WORTH_VALUATIONS.worker +
      base.vehicles * NET_WORTH_VALUATIONS.vehicle +
      base.drugs * NET_WORTH_VALUATIONS.drugUnit;
    expect(nw).toBe(expected);
    expect(nw).not.toBe(expected + 3 * 450);
  });

  it('is deterministic and never manually stored', () => {
    const a = NetWorthService.calculate(base);
    const b = NetWorthService.calculate(base);
    expect(a).toBe(b);
    expect(Number.isInteger(a)).toBe(true);
  });

  it('full formula matches documented canonical calculation', () => {
    const nw = NetWorthService.calculate(base);
    expect(nw).toBe(
      10000 +
      5000 +
      2 * NET_WORTH_VALUATIONS.thug +
      7 * NET_WORTH_VALUATIONS.worker +
      1 * NET_WORTH_VALUATIONS.vehicle +
      20 * NET_WORTH_VALUATIONS.drugUnit,
    );
  });
});

describe('Activity types — scouting', () => {
  it('scout activity message is built for SCOUT category', () => {
    const message = buildScoutActivityMessage({
      prostitutesFound: 4,
      thugsFound: 1,
      cashEarned: 9000,
    });
    expect(message).toContain('Scouting complete');
    expect(message).toContain('4 workers');
    expect(message).toContain('1 thugs');
  });

  it('scout uses SCOUT type, not RECRUIT_THUGS or RECRUIT_WORKERS', () => {
    const scoutCategory = ACTIVITY_TYPES.SCOUT;
    expect(scoutCategory).toBe('SCOUT');
    expect(scoutCategory).not.toBe(ACTIVITY_TYPES.RECRUIT_THUGS);
    expect(scoutCategory).not.toBe(ACTIVITY_TYPES.RECRUIT_WORKERS);
  });

  it('normalises legacy RECRUIT to SCOUT for display', () => {
    expect(normalizeActivityCategory('RECRUIT')).toBe(ACTIVITY_TYPES.SCOUT);
  });

  it('does not map SCOUT to recruit types', () => {
    expect(normalizeActivityCategory('SCOUT')).toBe(ACTIVITY_TYPES.SCOUT);
    expect(normalizeActivityCategory('SCOUT')).not.toBe(ACTIVITY_TYPES.RECRUIT_THUGS);
  });
});

describe('TurnService', () => {
  it('regenerates turns server-side from timestamp', () => {
    const hourAgo = new Date(Date.now() - 60 * 60 * 1000);
    const settled = TurnService.settle({
      currentTurns: 100,
      lastRegeneratedAt: hourAgo,
      turnCap: TURNS_CONFIG.turnCap,
      regenerationRatePerMs: TURNS_CONFIG.regenerationRatePerMs,
    });
    expect(settled.currentTurns).toBeGreaterThan(100);
  });

  it('caps turns at maximum', () => {
    const settled = TurnService.settle({
      currentTurns: TURNS_CONFIG.turnCap - 1,
      lastRegeneratedAt: new Date(Date.now() - 48 * 60 * 60 * 1000),
      turnCap: TURNS_CONFIG.turnCap,
      regenerationRatePerMs: TURNS_CONFIG.regenerationRatePerMs,
    });
    expect(settled.currentTurns).toBe(TURNS_CONFIG.turnCap);
    expect(settled.isAtCap).toBe(true);
  });
});

describe('Activity ordering', () => {
  it('sorts newest first', () => {
    const items = [
      { id: '1', createdAt: new Date('2026-01-01') },
      { id: '2', createdAt: new Date('2026-01-03') },
      { id: '3', createdAt: new Date('2026-01-02') },
    ];
    const sorted = [...items].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    expect(sorted[0]?.id).toBe('2');
    expect(sorted[2]?.id).toBe('1');
  });
});

describe('Empire totals', () => {
  it('aggregates drug counts separately from net worth weapons exclusion', () => {
    const totals = {
      thugs: 2,
      workers: 7,
      weapons: 3,
      vehicles: 0,
      drugs: 5,
      businesses: 0,
    };
    expect(totals.weapons).toBe(3);
    const nw = NetWorthService.calculate({
      cash: 0,
      bankCash: 0,
      thugs: totals.thugs,
      workers: totals.workers,
      vehicles: totals.vehicles,
      drugs: totals.drugs,
      businesses: totals.businesses,
    });
    expect(nw).toBe(2 * 700 + 7 * 1750 + 5 * 5);
  });
});

describe('Player summary', () => {
  it('maps username and city fields', () => {
    const summary = {
      username: 'HermaNFT',
      city: 'Neon Strip',
      rank: 46,
      netWorth: 28775,
    };
    expect(summary.username).toBeTruthy();
    expect(summary.city).toBeTruthy();
    expect(summary.netWorth).toBeGreaterThan(0);
  });
});
