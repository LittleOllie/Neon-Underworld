import { describe, it, expect } from 'vitest';
import {
  estimateDrugUnitsProduced,
  estimateHashProduceNet,
  hashProduceBreakEvenThugRatio,
  isHashProduceLikelyNetNegative,
  resolvePostProduceDrugCounts,
} from '@/lib/game-engine/produce-economy';
import { planSupplyConsumption, applySupplyConsumption } from '@/config/game/supply-economy';
import { resolveProduction } from '@/lib/game-engine/production';
import { calculateProstituteHappiness } from '@/lib/game-engine/happiness';

describe('produce economy estimates', () => {
  it('break-even thug ratio is ~0.556 thugs per worker', () => {
    expect(hashProduceBreakEvenThugRatio()).toBeCloseTo(1 / (150 * 0.012), 4);
  });

  it('balanced 500W/500T at 100 turns is net hash positive', () => {
    const est = estimateHashProduceNet({
      prostitutes: 500,
      thugs: 500,
      turnsSpent: 100,
      thugHappiness: 85,
    });
    expect(est.netHash).toBeGreaterThan(0);
  });

  it('worker-heavy 2000W/500T is net hash negative', () => {
    const est = estimateHashProduceNet({
      prostitutes: 2000,
      thugs: 500,
      turnsSpent: 100,
      thugHappiness: 85,
    });
    expect(est.netHash).toBeLessThan(0);
    expect(isHashProduceLikelyNetNegative({
      prostitutes: 2000,
      thugs: 500,
      turnsSpent: 100,
    })).toBe(true);
  });

  it('thug-heavy 500W/2000T at 100 turns is strongly net positive', () => {
    const est = estimateHashProduceNet({
      prostitutes: 500,
      thugs: 2000,
      turnsSpent: 100,
      thugHappiness: 85,
    });
    expect(est.netHash).toBeGreaterThan(500);
  });
});

describe('resolvePostProduceDrugCounts', () => {
  it('applies hash supply consumption then adds hash production', () => {
    const counts = resolvePostProduceDrugCounts({
      drugType: 'hash',
      drugUnitsProduced: 420,
      beforeDrugs: { hash: 400, shrooms: 0, coke: 0, heroin: 0 },
      suppliesAfter: { hash: 65, condoms: 900, beer: 50 },
    });
    expect(counts.hash).toBe(485);
  });

  it('consumes hash but adds coke when producing coke', () => {
    const counts = resolvePostProduceDrugCounts({
      drugType: 'coke',
      drugUnitsProduced: 200,
      beforeDrugs: { hash: 400, shrooms: 0, coke: 10, heroin: 0 },
      suppliesAfter: { hash: 65, condoms: 900, beer: 50 },
    });
    expect(counts.hash).toBe(65);
    expect(counts.coke).toBe(210);
  });
});

describe('hash inventory never negative', () => {
  it('supply consumption floors hash at zero before production adds back', () => {
    const plan = planSupplyConsumption(500, 500, 100, {
      condoms: 1000,
      hash: 50,
      beer: 1000,
    });
    const after = applySupplyConsumption(
      { condoms: 1000, hash: 50, beer: 1000 },
      plan.consumed,
    );
    expect(after.hash).toBe(0);
    const counts = resolvePostProduceDrugCounts({
      drugType: 'hash',
      drugUnitsProduced: 564,
      beforeDrugs: { hash: 50, shrooms: 0, coke: 0, heroin: 0 },
      suppliesAfter: after,
    });
    expect(counts.hash).toBe(564);
    expect(counts.hash).toBeGreaterThanOrEqual(0);
  });
});

describe('drug choice does not change production rate', () => {
  it('all four drugs produce identical units with same seed', () => {
    const base = {
      turnsSpent: 100,
      thugCount: 100,
      prostituteCount: 100,
      prostituteHappiness: 85,
      thugHappiness: 85,
      prostitutePayoutPercent: 50,
      seed: 99,
    };
    const hash = resolveProduction({ ...base, drugType: 'hash' });
    const heroin = resolveProduction({ ...base, drugType: 'heroin' });
    expect(hash.drugUnitsProduced).toBe(heroin.drugUnitsProduced);
  });
});

describe('split produce rounding', () => {
  it('sub-cap runs produce similar totals when split vs single', () => {
    const single = estimateDrugUnitsProduced({ turnsSpent: 100, thugCount: 100, thugHappiness: 85 });
    const split = [50, 50].reduce(
      (sum, turns) =>
        sum + estimateDrugUnitsProduced({ turnsSpent: turns, thugCount: 100, thugHappiness: 85 }),
      0,
    );
    expect(single).toBe(split);
  });

  it('documents per-action cap: splitting large runs can exceed single capped total', () => {
    const single = estimateDrugUnitsProduced({ turnsSpent: 1000, thugCount: 500, thugHappiness: 85 });
    const split = Array.from({ length: 10 }, () =>
      estimateDrugUnitsProduced({ turnsSpent: 100, thugCount: 500, thugHappiness: 85 }),
    ).reduce((a, b) => a + b, 0);
    expect(single).toBe(2000);
    expect(split).toBeGreaterThan(single);
  });

  it('splitting may slightly increase supply consumption due to ceil', () => {
    const single = planSupplyConsumption(500, 500, 1000, {
      condoms: 99999,
      hash: 99999,
      beer: 99999,
    });
    const split = Array.from({ length: 10 }, () =>
      planSupplyConsumption(500, 500, 100, {
        condoms: 99999,
        hash: 99999,
        beer: 99999,
      }),
    );
    const splitHash = split.reduce((sum, p) => sum + (p.required.hash ?? 0), 0);
    expect(splitHash).toBeGreaterThanOrEqual(single.required.hash ?? 0);
    expect(splitHash - (single.required.hash ?? 0)).toBeLessThanOrEqual(10);
  });
});

describe('supply shortage affects morale after consumption', () => {
  it('low hash after consumption reduces worker morale', () => {
    const before = calculateProstituteHappiness({
      prostitutes: 500,
      thugs: 500,
      hash: 5000,
      condoms: 5000,
      prostitutePayoutPercent: 50,
    });
    const after = calculateProstituteHappiness({
      prostitutes: 500,
      thugs: 500,
      hash: 0,
      condoms: 5000,
      prostitutePayoutPercent: 50,
    });
    expect(after.score).toBeLessThan(before.score);
  });
});
