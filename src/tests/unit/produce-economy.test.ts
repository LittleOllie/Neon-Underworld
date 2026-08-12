import { describe, it, expect } from 'vitest';
import {
  DRUG_PRODUCTION_RATES,
  expectedDrugUnits,
  getDrugProductionRate,
  turnsToReachDrugUnits,
} from '@/config/game/drug-production-rates';
import { getDrugStreetPrice } from '@/config/game/drug-street-prices';
import {
  estimateDrugUnitsProduced,
  estimateHashProduceNet,
  estimateSplitDrugUnitsProduced,
  hashProduceBreakEvenThugRatio,
  isHashProduceLikelyNetNegative,
  resolvePostProduceDrugCounts,
} from '@/lib/game-engine/produce-economy';
import { expectedDrugUnits, turnsToReachDrugUnits } from '@/config/game/drug-production-rates';
import { planSupplyConsumption, applySupplyConsumption } from '@/config/game/supply-economy';
import { resolveProduction, type ProductionDrug } from '@/lib/game-engine/production';
import { calculateProstituteHappiness } from '@/lib/game-engine/happiness';
import { happinessEfficiencyModifier } from '@/lib/game-engine/happiness';

const DRUGS: ProductionDrug[] = ['hash', 'shrooms', 'coke', 'heroin'];

describe('drug production rates', () => {
  it('hash has highest rate, heroin lowest', () => {
    expect(DRUG_PRODUCTION_RATES.hash).toBeGreaterThan(DRUG_PRODUCTION_RATES.shrooms);
    expect(DRUG_PRODUCTION_RATES.shrooms).toBeGreaterThan(DRUG_PRODUCTION_RATES.coke);
    expect(DRUG_PRODUCTION_RATES.coke).toBeGreaterThan(DRUG_PRODUCTION_RATES.heroin);
  });

  it('getDrugProductionRate returns canonical values', () => {
    expect(getDrugProductionRate('hash')).toBe(0.012);
    expect(getDrugProductionRate('heroin')).toBe(0.004);
  });
});

describe('produce economy estimates', () => {
  it('break-even thug ratio uses hash rate', () => {
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

  it('500W/500T at 1000 turns stays net hash positive without cap', () => {
    const est = estimateHashProduceNet({
      prostitutes: 500,
      thugs: 500,
      turnsSpent: 1000,
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
});

describe('drug-specific production ordering', () => {
  it('same thugs/turns/seed: hash > shrooms > coke > heroin', () => {
    const base = {
      turnsSpent: 100,
      thugCount: 500,
      prostituteCount: 100,
      prostituteHappiness: 85,
      thugHappiness: 85,
      prostitutePayoutPercent: 50,
      seed: 42,
    };
    const outputs = DRUGS.map((drugType) =>
      resolveProduction({ ...base, drugType }).drugUnitsProduced,
    );
    expect(outputs[0]).toBeGreaterThan(outputs[1]!);
    expect(outputs[1]).toBeGreaterThan(outputs[2]!);
    expect(outputs[2]).toBeGreaterThan(outputs[3]!);
  });
});

describe('split produce invariance (no per-action cap)', () => {
  const thugs = 500;
  const morale = 85;

  for (const drug of DRUGS) {
    it(`${drug}: 1×1000 equals 10×100 production total`, () => {
      const single = estimateDrugUnitsProduced({
        turnsSpent: 1000,
        thugCount: thugs,
        drugType: drug,
        thugHappiness: morale,
      });
      const split = estimateSplitDrugUnitsProduced({
        turnChunks: Array(10).fill(100),
        thugCount: thugs,
        drugType: drug,
        thugHappiness: morale,
      });
      expect(split).toBe(single);
    });
  }

  it('1×5000 equals 50×100 for hash', () => {
    const eff = happinessEfficiencyModifier(morale);
    const single = estimateDrugUnitsProduced({
      turnsSpent: 5000,
      thugCount: thugs,
      drugType: 'hash',
      thugHappiness: morale,
    });
    const split = estimateSplitDrugUnitsProduced({
      turnChunks: Array(50).fill(100),
      thugCount: thugs,
      drugType: 'hash',
      thugHappiness: morale,
    });
    expect(split).toBe(single);
    expect(single).toBe(expectedDrugUnits(5000, thugs, 'hash', eff));
  });

  it('splitting may add at most 10 extra supply units from ceil rounding', () => {
    const single = planSupplyConsumption(500, 500, 1000, {
      condoms: 99999,
      hash: 99999,
      beer: 99999,
    });
    const splitHash = Array.from({ length: 10 }, () =>
      planSupplyConsumption(500, 500, 100, {
        condoms: 99999,
        hash: 99999,
        beer: 99999,
      }),
    ).reduce((sum, p) => sum + (p.required.hash ?? 0), 0);
    expect(splitHash - (single.required.hash ?? 0)).toBeLessThanOrEqual(10);
  });
});

describe('street economic balance', () => {
  it('no sale drug exceeds 3.5× hash best-street value at 500 thugs / 100 turns', () => {
    const thugs = 500;
    const turns = 100;
    const morale = happinessEfficiencyModifier(85);
    const districts = ['neon-strip', 'docklands', 'old-quarter'] as const;

    const hashBest = Math.max(
      ...districts.map((d) =>
        expectedDrugUnits(turns, thugs, 'hash', morale) * getDrugStreetPrice(d, 'hash'),
      ),
    );
    for (const drug of ['shrooms', 'coke', 'heroin'] as const) {
      const best = Math.max(
        ...districts.map((d) =>
          expectedDrugUnits(turns, thugs, drug, morale) * getDrugStreetPrice(d, drug),
        ),
      );
      expect(best / hashBest).toBeLessThanOrEqual(3.5);
    }
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

describe('turnsToReachDrugUnits', () => {
  it('500 thugs at 80% morale reach 2000 hash in ~363 turns', () => {
    const eff = happinessEfficiencyModifier(80);
    const turns = turnsToReachDrugUnits(500, 'hash', 2000, eff);
    expect(turns).toBe(363);
  });
});
