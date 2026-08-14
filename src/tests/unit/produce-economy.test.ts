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
  estimateProducePreview,
  estimateSplitDrugUnitsProduced,
  resolvePostProduceDrugCounts,
} from '@/lib/game-engine/produce-economy';
import { planSupplyConsumption } from '@/config/game/supply-economy';
import { resolveSupplyConsumptionForAction } from '@/lib/game-engine/supply-consumption';
import { resolveProduction, type ProductionDrug } from '@/lib/game-engine/production';
import { calculateProstituteHappiness } from '@/lib/game-engine/happiness';
import { happinessEfficiencyModifier } from '@/lib/game-engine/happiness';
import { PRODUCTION_CONFIG } from '@/config/game/balance';
import { grossWorkerCash, playerCashFromGross } from '@/lib/game-engine/worker-economics';

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

describe('hash production supply exemption', () => {
  it('starter crew 2W/1T does not consume worker hash during hash produce', () => {
    const result = resolveSupplyConsumptionForAction({
      prostitutes: 2,
      thugs: 1,
      turnsSpent: 25,
      condoms: 100,
      hash: 50,
      beer: 100,
      exemptWorkerHash: true,
    });
    expect(result.plan.consumed.hash ?? 0).toBe(0);
    expect(result.plan.consumed.condoms).toBeGreaterThan(0);
    expect(result.plan.consumed.beer).toBeGreaterThan(0);
    expect(result.inventoryAfter.hash).toBe(50);
  });

  it('scout still consumes worker hash (no exemption)', () => {
    const result = resolveSupplyConsumptionForAction({
      prostitutes: 2,
      thugs: 1,
      turnsSpent: 25,
      condoms: 100,
      hash: 50,
      beer: 100,
    });
    expect(result.plan.consumed.hash).toBeGreaterThan(0);
    expect(result.inventoryAfter.hash).toBeLessThan(50);
  });

  it('other drug production still requires worker hash consumption', () => {
    const plan = planSupplyConsumption(2, 1, 25, { condoms: 100, hash: 50, beer: 100 });
    expect(plan.required.hash).toBeGreaterThan(0);
    expect(plan.consumed.hash).toBeGreaterThan(0);
  });

  it('worker-heavy hash produce does not consume hash upkeep', () => {
    const plan = planSupplyConsumption(
      2000,
      500,
      100,
      { condoms: 99999, hash: 100, beer: 99999 },
      { exemptWorkerHash: true },
    );
    expect(plan.required.hash).toBeUndefined();
    expect(plan.consumed.hash).toBeUndefined();
    expect(plan.required.condoms).toBeGreaterThan(0);
    expect(plan.required.beer).toBeGreaterThan(0);
  });

  it('zero starting hash still allows hash production supply planning', () => {
    const result = resolveSupplyConsumptionForAction({
      prostitutes: 2,
      thugs: 1,
      turnsSpent: 25,
      condoms: 100,
      hash: 0,
      beer: 100,
      exemptWorkerHash: true,
    });
    expect(result.inventoryAfter.hash).toBe(0);
    expect(result.plan.consumed.hash ?? 0).toBe(0);
  });
});

describe('hash production morale exemption', () => {
  it('exempts hash from worker morale penalty during hash production', () => {
    const normal = calculateProstituteHappiness({
      prostitutes: 2,
      thugs: 1,
      hash: 0,
      condoms: 100,
      prostitutePayoutPercent: 50,
    });
    const exempt = calculateProstituteHappiness({
      prostitutes: 2,
      thugs: 1,
      hash: 0,
      condoms: 100,
      prostitutePayoutPercent: 50,
      exemptHashMorale: true,
    });
    expect(exempt.score).toBeGreaterThan(normal.score);
    expect(exempt.hashReadiness).toBe(1);
  });

  it('condoms still affect morale during hash production', () => {
    const good = calculateProstituteHappiness({
      prostitutes: 2,
      thugs: 1,
      hash: 0,
      condoms: 100,
      prostitutePayoutPercent: 50,
      exemptHashMorale: true,
    });
    const low = calculateProstituteHappiness({
      prostitutes: 2,
      thugs: 1,
      hash: 0,
      condoms: 0,
      prostitutePayoutPercent: 50,
      exemptHashMorale: true,
    });
    expect(good.score).toBeGreaterThan(low.score);
  });
});

describe('produce economy estimates', () => {
  it('hash produce net equals produced units (no worker hash upkeep)', () => {
    const est = estimateHashProduceNet({
      prostitutes: 2000,
      thugs: 500,
      turnsSpent: 100,
      thugHappiness: 85,
    });
    expect(est.hashConsumed).toBe(0);
    expect(est.netHash).toBe(est.hashProduced);
    expect(est.netHash).toBeGreaterThan(0);
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
});

describe('resolvePostProduceDrugCounts', () => {
  it('adds hash production without deducting worker hash upkeep', () => {
    const counts = resolvePostProduceDrugCounts({
      drugType: 'hash',
      drugUnitsProduced: 420,
      beforeDrugs: { hash: 400, shrooms: 0, coke: 0, heroin: 0 },
      suppliesAfter: { hash: 400, condoms: 900, beer: 50 },
    });
    expect(counts.hash).toBe(820);
  });
});

describe('produce preview vs execution', () => {
  const base = {
    turnsSpent: 100,
    thugCount: 500,
    prostituteCount: 100,
    prostituteHappiness: 85,
    thugHappiness: 85,
    prostitutePayoutPercent: 50,
    seed: 42,
    drugProductionBonus: 0.1,
  };

  for (const drugType of DRUGS) {
    it(`${drugType}: execution output falls within preview range`, () => {
      const preview = estimateProducePreview({
        turnsSpent: base.turnsSpent,
        thugCount: base.thugCount,
        prostituteCount: base.prostituteCount,
        drugType,
        thugHappiness: base.thugHappiness,
        workerHappiness: base.prostituteHappiness,
        payoutPercent: base.prostitutePayoutPercent,
        drugProductionBonus: base.drugProductionBonus,
      });
      const outcome = resolveProduction({ ...base, drugType });
      expect(outcome.drugUnitsProduced).toBeGreaterThanOrEqual(preview.drugMin);
      expect(outcome.drugUnitsProduced).toBeLessThanOrEqual(preview.drugMax);
    });
  }

  it('hash preview net range matches drug output range (no hash upkeep)', () => {
    const preview = estimateProducePreview({
      turnsSpent: 25,
      thugCount: 1,
      prostituteCount: 2,
      drugType: 'hash',
      thugHappiness: 85,
      workerHappiness: 85,
    });
    expect(preview.hashNetMin).toBe(preview.drugMin);
    expect(preview.hashNetMax).toBe(preview.drugMax);
  });

  it('preview uses produce cash rate ($12), not scout rate', () => {
    const preview = estimateProducePreview({
      turnsSpent: 100,
      thugCount: 10,
      prostituteCount: 50,
      drugType: 'hash',
      thugHappiness: 80,
      workerHappiness: 80,
      payoutPercent: 50,
    });
    const gross = grossWorkerCash(50, 100, PRODUCTION_CONFIG.cashPerProstitutePerTurn);
    const expected = Math.floor(
      playerCashFromGross(gross, 50) * happinessEfficiencyModifier(80),
    );
    expect(PRODUCTION_CONFIG.cashPerProstitutePerTurn).toBe(12);
    expect(preview.playerCash).toBe(expected);
  });

  it('preview includes drug lab bonus in output range', () => {
    const base = estimateProducePreview({
      turnsSpent: 100,
      thugCount: 500,
      prostituteCount: 100,
      drugType: 'hash',
      thugHappiness: 85,
      drugProductionBonus: 0,
    });
    const boosted = estimateProducePreview({
      turnsSpent: 100,
      thugCount: 500,
      prostituteCount: 100,
      drugType: 'hash',
      thugHappiness: 85,
      drugProductionBonus: 0.2,
    });
    expect(boosted.drugMin).toBeGreaterThan(base.drugMin);
    expect(boosted.drugMax).toBeGreaterThan(base.drugMax);
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
  it('low hash after consumption reduces worker morale (non-hash actions)', () => {
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
