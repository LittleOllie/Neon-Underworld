import { describe, it, expect } from 'vitest';
import {
  estimateCountRange,
  attackableCashExposureRatio,
  drugNetWorthExposureRatio,
  buildDeepIntelSnapshot,
  formatCountEstimateRange,
} from '@/lib/game-engine/combat/deep-intel';
import { nwRelativeExposureBand, deepWeaponReadinessBand } from '@/lib/game-engine/combat/intel-bands';
import { createCombatRng } from '@/lib/game-engine/combat/combat-random';
import { THUG_HIRE_PRICE, hireThugsTotalCost, THUG_SELL_PRICE, sellThugsTotalPayout } from '@/config/game/hire-thugs-rules';
import { CANONICAL_NET_WORTH_VALUATIONS } from '@/lib/game-engine/canonical-net-worth';
import { calculateCanonicalNetWorthFromPlayer } from '@/lib/game-engine/canonical-net-worth';

describe('Hire Thugs config', () => {
  it('uses canonical $7,500 per thug', () => {
    expect(THUG_HIRE_PRICE).toBe(7500);
    expect(hireThugsTotalCost(50)).toBe(375_000);
    expect(hireThugsTotalCost(150)).toBe(1_125_000);
  });

  it('sells thugs at 70% of hire price', () => {
    expect(THUG_SELL_PRICE).toBe(5250);
    expect(sellThugsTotalPayout(10)).toBe(52_500);
    expect(THUG_SELL_PRICE).toBeLessThan(THUG_HIRE_PRICE);
  });
});

describe('NW-relative exposure bands', () => {
  it('rates cash relative to target NW', () => {
    expect(nwRelativeExposureBand(8_000_000 / 10_000_000)).toBe('Extreme');
    expect(nwRelativeExposureBand(1_500_000 / 2_000_000)).toBe('Extreme');
    expect(nwRelativeExposureBand(1_500_000 / 10_000_000)).toBe('Moderate');
  });

  it('handles zero NW safely', () => {
    expect(nwRelativeExposureBand(attackableCashExposureRatio(0, 0))).toBe('Very Low');
    expect(nwRelativeExposureBand(attackableCashExposureRatio(1_000, 0))).toBe('Extreme');
  });
});

describe('estimateCountRange', () => {
  it('contains actual value within approximate band', () => {
    const rng = createCombatRng(42);
    const actual = 1000;
    const { min, max } = estimateCountRange(actual, rng);
    expect(min).toBeGreaterThanOrEqual(0);
    expect(max).toBeGreaterThanOrEqual(min);
    expect(actual).toBeGreaterThanOrEqual(min * 0.95);
    expect(actual).toBeLessThanOrEqual(max * 1.05);
  });

  it('scales to large counts', () => {
    const rng = createCombatRng(99);
    const { min, max } = estimateCountRange(85_000, rng);
    expect(min).toBeGreaterThan(50_000);
    expect(max).toBeLessThan(120_000);
  });

  it('returns zero range for zero count', () => {
    const rng = createCombatRng(1);
    expect(estimateCountRange(0, rng)).toEqual({ min: 0, max: 0 });
  });

  it('is stable for the same seed', () => {
    const a = estimateCountRange(5000, createCombatRng(12345));
    const b = estimateCountRange(5000, createCombatRng(12345));
    expect(a).toEqual(b);
  });
});

describe('deepWeaponReadinessBand', () => {
  it('reflects usable coverage not idle stockpile', () => {
    expect(
      deepWeaponReadinessBand(500, {
        armedThugs: 480,
        totalStrength: 12000,
      }),
    ).toBe('Heavily Armed');

    expect(
      deepWeaponReadinessBand(500, {
        armedThugs: 50,
        totalStrength: 250,
      }),
    ).toBe('Poorly Armed');
  });

  it('marks unarmed targets poorly', () => {
    expect(
      deepWeaponReadinessBand(200, { armedThugs: 0, totalStrength: 200 }),
    ).toBe('Poorly Armed');
  });
});

describe('buildDeepIntelSnapshot', () => {
  const baseTarget = {
    id: 'target-1',
    alias: 'Ghost',
    districtName: 'Neon Strip',
    thugs: 1000,
    prostitutes: 5000,
    glocks: 100,
    uzis: 50,
    aks: 200,
    cash: 1_500_000,
    hash: 1000,
    shrooms: 0,
    coke: 500,
    heroin: 0,
    cartelId: null,
    canonicalNetWorth: 10_000_000,
  };

  it('does not expose exact secret counts in payload', () => {
    const snapshot = buildDeepIntelSnapshot(baseTarget, 'scout-1', 'key-1');
    expect(Object.keys(snapshot)).not.toContain('thugs');
    expect(Object.keys(snapshot)).not.toContain('prostitutes');
    expect(Object.keys(snapshot)).not.toContain('cash');
    expect(snapshot.estimatedThugMin).toBeLessThanOrEqual(baseTarget.thugs);
    expect(snapshot.estimatedThugMax).toBeGreaterThanOrEqual(baseTarget.thugs);
    expect(snapshot.estimatedWorkerMin).toBeLessThanOrEqual(baseTarget.prostitutes);
    expect(snapshot.estimatedWorkerMax).toBeGreaterThanOrEqual(baseTarget.prostitutes);
  });

  it('produces stable snapshot for same inputs', () => {
    const at = new Date('2026-01-01T12:00:00.000Z');
    const a = buildDeepIntelSnapshot(baseTarget, 'scout-1', 'stable-key', at);
    const b = buildDeepIntelSnapshot(baseTarget, 'scout-1', 'stable-key', at);
    expect(a).toEqual(b);
  });

  it('changes snapshot on refresh idempotency key', () => {
    const a = buildDeepIntelSnapshot(baseTarget, 'scout-1', 'key-a');
    const b = buildDeepIntelSnapshot(baseTarget, 'scout-1', 'key-b');
    expect(a.estimatedThugMin !== b.estimatedThugMin || a.estimatedThugMax !== b.estimatedThugMax).toBe(true);
  });

  it('computes drug exposure from drug NW ratio', () => {
    const drugUnits = 1000 + 500;
    const drugNw = drugUnits * CANONICAL_NET_WORTH_VALUATIONS.drugUnit;
    const ratio = drugNw / baseTarget.canonicalNetWorth;
    const snapshot = buildDeepIntelSnapshot(baseTarget, 'scout-1', 'drug-key');
    expect(snapshot.drugExposureBand).toBe(nwRelativeExposureBand(ratio));
  });
});

describe('hire NW behaviour', () => {
  it('reduces canonical NW by roughly cash minus thug value per hire', () => {
    const before = calculateCanonicalNetWorthFromPlayer({
      cash: 1_000_000,
      bankCash: 0,
      thugs: 100,
      prostitutes: 0,
      rides: 0,
      hash: 0,
      shrooms: 0,
      coke: 0,
      heroin: 0,
    });
    const hireQty = 10;
    const cost = hireThugsTotalCost(hireQty);
    const after = calculateCanonicalNetWorthFromPlayer({
      cash: 1_000_000 - cost,
      bankCash: 0,
      thugs: 100 + hireQty,
      prostitutes: 0,
      rides: 0,
      hash: 0,
      shrooms: 0,
      coke: 0,
      heroin: 0,
    });
    const delta = after - before;
    const expectedPerThug = CANONICAL_NET_WORTH_VALUATIONS.thug - THUG_HIRE_PRICE;
    expect(delta).toBe(expectedPerThug * hireQty);
  });
});

describe('formatCountEstimateRange', () => {
  it('formats ranges with locale separators', () => {
    expect(formatCountEstimateRange(850, 1150)).toMatch(/850/);
    expect(formatCountEstimateRange(850, 1150)).toMatch(/1/);
  });
});
