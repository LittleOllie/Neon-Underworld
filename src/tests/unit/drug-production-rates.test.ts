import { describe, it, expect } from 'vitest';
import {
  DRUG_PRODUCTION_RATES,
  expectedDrugUnits,
  getDrugProductionRate,
} from '@/config/game/drug-production-rates';

describe('drug-production-rates config', () => {
  it('exports ordered rates hash > shrooms > coke > heroin', () => {
    expect(DRUG_PRODUCTION_RATES.hash).toBe(0.012);
    expect(DRUG_PRODUCTION_RATES.shrooms).toBe(0.009);
    expect(DRUG_PRODUCTION_RATES.coke).toBe(0.006);
    expect(DRUG_PRODUCTION_RATES.heroin).toBe(0.004);
  });

  it('expectedDrugUnits scales linearly with no cap', () => {
    expect(expectedDrugUnits(1000, 500, 'hash')).toBe(6000);
    expect(expectedDrugUnits(5000, 500, 'hash')).toBe(30_000);
  });

  it('getDrugProductionRate is the single accessor', () => {
    expect(getDrugProductionRate('coke')).toBe(DRUG_PRODUCTION_RATES.coke);
  });
});
