import { describe, it, expect } from 'vitest';
import {
  bandFromPercent,
  statusTextFromBand,
  readinessToPercent,
  buildWorkerStabilityMeter,
  buildWeaponCoverageMeter,
  buildWorkerPayoutMeter,
  buildEmpireStatusMeters,
  abbreviateCash,
} from './status-presentation';

const basePlayer = {
  thugs: 10,
  prostitutes: 5,
  glocks: 5,
  uzis: 2,
  aks: 1,
  rides: 2,
  hash: 20,
  shrooms: 0,
  coke: 0,
  heroin: 0,
  businesses: 0,
  condoms: 15,
  beer: 10,
  prostitutePayoutPercent: 50,
};

describe('bandFromPercent', () => {
  it('maps critical through excellent deterministically', () => {
    expect(bandFromPercent(10)).toBe('critical');
    expect(bandFromPercent(24)).toBe('critical');
    expect(bandFromPercent(25)).toBe('low');
    expect(bandFromPercent(50)).toBe('adequate');
    expect(bandFromPercent(70)).toBe('stable');
    expect(bandFromPercent(85)).toBe('excellent');
    expect(bandFromPercent(100)).toBe('excellent');
  });
});

describe('readinessToPercent', () => {
  it('rounds to whole numbers', () => {
    expect(readinessToPercent(0.724)).toBe(72);
    expect(readinessToPercent(1.2)).toBe(100);
  });
});

describe('status meters', () => {
  it('worker stability uses happiness score', () => {
    const m = buildWorkerStabilityMeter(basePlayer);
    expect(m.value).toBeGreaterThan(0);
    expect(m.value).toBeLessThanOrEqual(100);
    expect(Number.isInteger(m.value)).toBe(true);
    expect(m.statusText).toBe(statusTextFromBand(m.band));
  });

  it('weapon coverage reflects armed ratio', () => {
    const m = buildWeaponCoverageMeter({ ...basePlayer, thugs: 10, glocks: 10, uzis: 0, aks: 0 });
    expect(m.value).toBe(100);
    expect(m.band).toBe('excellent');
  });

  it('payout meter shows trade-off not always bad', () => {
    const low = buildWorkerPayoutMeter({ ...basePlayer, prostitutePayoutPercent: 20 });
    expect(low.supportingText).toMatch(/High profit/);
    const high = buildWorkerPayoutMeter({ ...basePlayer, prostitutePayoutPercent: 90 });
    expect(high.supportingText).toMatch(/Defensive/);
  });

  it('buildEmpireStatusMeters returns all required meters', () => {
    const m = buildEmpireStatusMeters(basePlayer);
    expect(m.worker.stability.label).toBe('Worker Stability');
    expect(m.thug.weaponCoverage.label).toBe('Weapon Coverage');
    expect(m.worker.payout.label).toBe('Worker Payout');
  });
});

describe('abbreviateCash', () => {
  it('abbreviates large values for mobile header', () => {
    expect(abbreviateCash(556243)).toBe('$556K');
    expect(abbreviateCash(1200000)).toBe('$1.2M');
  });
});
