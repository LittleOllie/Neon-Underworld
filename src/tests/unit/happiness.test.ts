import { describe, it, expect } from 'vitest';
import {
  calculateProstituteHappiness,
  calculateThugHappiness,
  happinessRecruitmentModifier,
} from '@/lib/game-engine/happiness';

describe('happiness', () => {
  it('calculates prostitute happiness from supplies', () => {
    const good = calculateProstituteHappiness({
      prostitutes: 5,
      thugs: 2,
      hash: 10,
      condoms: 20,
      prostitutePayoutPercent: 50,
    });
    const poor = calculateProstituteHappiness({
      prostitutes: 5,
      thugs: 0,
      hash: 0,
      condoms: 0,
      prostitutePayoutPercent: 20,
    });
    expect(good.score).toBeGreaterThan(poor.score);
  });

  it('calculates thug weapon readiness', () => {
    const armed = calculateThugHappiness({ thugs: 5, glocks: 5, uzis: 0, aks: 0, beer: 10 });
    const unarmed = calculateThugHappiness({ thugs: 5, glocks: 0, uzis: 0, aks: 0, beer: 10 });
    expect(armed.weaponReadiness).toBeGreaterThan(unarmed.weaponReadiness);
  });

  it('applies happiness recruitment modifier', () => {
    const high = happinessRecruitmentModifier(90, 90);
    const low = happinessRecruitmentModifier(30, 30);
    expect(high).toBeGreaterThan(low);
  });
});
