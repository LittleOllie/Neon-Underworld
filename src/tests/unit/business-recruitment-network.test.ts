import { describe, expect, it } from 'vitest';
import {
  calculateBusinessNetworkBonus,
  formatRecruitmentBonusDisplay,
  getBusinessTierRecruitmentContribution,
  MAX_THUG_RECRUITMENT_BONUS_PERCENT,
  MAX_WORKER_RECRUITMENT_BONUS_PERCENT,
  recruitmentBonusMultiplier,
  stackRecruitmentContributions,
} from '@/config/game/business-recruitment-rules';
import { resolveScouting } from '@/lib/game-engine/scouting';
import { happinessRecruitmentModifier } from '@/lib/game-engine/happiness';
import { DISTRICTS, SCOUTING_CONFIG } from '@/config/game/balance';
import { REDLITE_SCOUT_AREAS } from '@/config/game/redlite-rules';

const neonModifiers = DISTRICTS.find((d) => d.slug === 'neon-strip')!.modifiers;

const baseScoutInput = {
  turnsSpent: 100,
  districtModifiers: neonModifiers,
  districtSlug: 'neon-strip',
  areaSlug: 'clubs',
  prostituteHappiness: 80,
  thugHappiness: 80,
  prostituteCount: 50,
  thugCount: 20,
  prostitutePayoutPercent: 50,
  seed: 42_001,
};

describe('business recruitment network config', () => {
  it('assigns tier contributions by business type', () => {
    expect(getBusinessTierRecruitmentContribution('WAREHOUSE', 3)).toEqual({
      workerPercent: 12,
      thugPercent: 0,
    });
    expect(getBusinessTierRecruitmentContribution('NIGHTCLUB', 3)).toEqual({
      workerPercent: 8,
      thugPercent: 8,
    });
    expect(getBusinessTierRecruitmentContribution('DRUG_LAB', 3)).toEqual({
      workerPercent: 0,
      thugPercent: 12,
    });
  });

  it('returns zero network bonus with no businesses', () => {
    const network = calculateBusinessNetworkBonus([]);
    expect(network.workerBonusPercent).toBe(0);
    expect(network.thugBonusPercent).toBe(0);
    expect(network.workerMultiplier).toBe(1);
    expect(network.thugMultiplier).toBe(1);
  });

  it('stacks multiple businesses with diminishing returns', () => {
    const network = calculateBusinessNetworkBonus([
      { businessType: 'WAREHOUSE', level: 5 },
      { businessType: 'WAREHOUSE', level: 5 },
      { businessType: 'NIGHTCLUB', level: 5 },
    ]);
    expect(network.workerBonusPercent).toBeCloseTo(
      26 * 2.1 + 26 * 2.1 * 0.35 + 20 * 2.1 * 0.18,
      5,
    );
    expect(network.thugBonusPercent).toBeCloseTo(20 * 2.1, 5);
  });

  it('caps extreme ownership', () => {
    const businesses = Array.from({ length: 8 }, () => ({
      businessType: 'WAREHOUSE' as const,
      level: 5,
    }));
    const network = calculateBusinessNetworkBonus(businesses);
    expect(network.workerBonusPercent).toBeLessThanOrEqual(MAX_WORKER_RECRUITMENT_BONUS_PERCENT);
    expect(network.thugBonusPercent).toBeLessThanOrEqual(MAX_THUG_RECRUITMENT_BONUS_PERCENT);
    expect(network.workerBonusPercent).toBeGreaterThan(50);
  });

  it('formats recruitment bonus display', () => {
    expect(formatRecruitmentBonusDisplay(0)).toBe('None');
    expect(formatRecruitmentBonusDisplay(34)).toBe('+34%');
  });
});

describe('scout integration — business network', () => {
  it('matches zero-business behaviour when multiplier is 1', () => {
    const baseline = resolveScouting(baseScoutInput);
    const withDefaultNetwork = resolveScouting({
      ...baseScoutInput,
      businessNetwork: { workerMultiplier: 1, thugMultiplier: 1, workerBonusPercent: 0, thugBonusPercent: 0 },
    });
    expect(withDefaultNetwork).toEqual(baseline);
  });

  it('does not change scout cash when recruitment multipliers increase', () => {
    const baseline = resolveScouting(baseScoutInput);
    const boosted = resolveScouting({
      ...baseScoutInput,
      businessNetwork: {
        workerMultiplier: 2,
        thugMultiplier: 2,
        workerBonusPercent: 100,
        thugBonusPercent: 100,
      },
    });
    expect(boosted.cashEarned).toBe(baseline.cashEarned);
    expect(boosted.businessNetworkWorkerBonusPercent).toBe(100);
  });

  it('increases expected worker recruitment with warehouse network bonus', () => {
    const samples = 400;
    let baseWorkers = 0;
    let boostedWorkers = 0;
    for (let i = 0; i < samples; i++) {
      baseWorkers += resolveScouting({ ...baseScoutInput, seed: 90_000 + i }).prostitutesFound;
      boostedWorkers += resolveScouting({
        ...baseScoutInput,
        seed: 90_000 + i,
        businessNetwork: calculateBusinessNetworkBonus([{ businessType: 'WAREHOUSE', level: 5 }]),
      }).prostitutesFound;
    }
    expect(boostedWorkers).toBeGreaterThan(baseWorkers * 1.15);
  });

  it('increases thug recruitment for drug lab without affecting workers as much', () => {
    const docksInput = { ...baseScoutInput, areaSlug: 'docks', seed: 77_000 };
    const network = calculateBusinessNetworkBonus([{ businessType: 'DRUG_LAB', level: 5 }]);
    expect(network.workerMultiplier).toBe(1);
    expect(network.thugMultiplier).toBeGreaterThan(1.2);

    let baseThugs = 0;
    let boostedThugs = 0;
    for (let i = 0; i < 300; i++) {
      baseThugs += resolveScouting({ ...docksInput, seed: 77_000 + i }).thugsFound;
      boostedThugs += resolveScouting({
        ...docksInput,
        seed: 77_000 + i,
        businessNetwork: network,
      }).thugsFound;
    }
    expect(boostedThugs).toBeGreaterThan(baseThugs * 1.15);
  });

  it('still applies morale to recruitment with business network active', () => {
    const area = REDLITE_SCOUT_AREAS.find((entry) => entry.slug === 'clubs')!;
    const lowMoraleMod = happinessRecruitmentModifier(20, 20);
    const highMoraleMod = happinessRecruitmentModifier(100, 100);
    const network = calculateBusinessNetworkBonus([{ businessType: 'NIGHTCLUB', level: 5 }]);

    const lowBase =
      SCOUTING_CONFIG.baseProstitutesPerTurn *
      neonModifiers.prostituteRecruitment *
      area.prostituteRecruitment *
      lowMoraleMod *
      network.workerMultiplier;
    const highBase =
      SCOUTING_CONFIG.baseProstitutesPerTurn *
      neonModifiers.prostituteRecruitment *
      area.prostituteRecruitment *
      highMoraleMod *
      network.workerMultiplier;

    expect(highBase).toBeGreaterThan(lowBase * 1.3);
  });

  it('preserves split invariance in expectation with constant network bonus', () => {
    const network = calculateBusinessNetworkBonus([
      { businessType: 'WAREHOUSE', level: 4 },
      { businessType: 'NIGHTCLUB', level: 3 },
    ]);
    const single = resolveScouting({
      ...baseScoutInput,
      turnsSpent: 100,
      seed: 55_000,
      businessNetwork: network,
    });
    let splitWorkers = 0;
    let splitThugs = 0;
    for (let i = 0; i < 4; i++) {
      const chunk = resolveScouting({
        ...baseScoutInput,
        turnsSpent: 25,
        seed: 55_100 + i,
        businessNetwork: network,
      });
      splitWorkers += chunk.prostitutesFound;
      splitThugs += chunk.thugsFound;
    }
    const expectedWorkers =
      baseScoutInput.turnsSpent *
      SCOUTING_CONFIG.baseProstitutesPerTurn *
      neonModifiers.prostituteRecruitment *
      REDLITE_SCOUT_AREAS.find((entry) => entry.slug === 'clubs')!.prostituteRecruitment *
      happinessRecruitmentModifier(80, 80) *
      network.workerMultiplier;
    expect(Math.abs(single.prostitutesFound - expectedWorkers)).toBeLessThan(8);
    expect(Math.abs(splitWorkers - expectedWorkers)).toBeLessThan(12);
    expect(splitThugs).toBeGreaterThanOrEqual(0);
  });
});

describe('upgrade preview parity', () => {
  it('matches tier contribution progression', () => {
    const current = getBusinessTierRecruitmentContribution('WAREHOUSE', 2);
    const next = getBusinessTierRecruitmentContribution('WAREHOUSE', 3);
    expect(next.workerPercent).toBeGreaterThan(current.workerPercent);
    expect(recruitmentBonusMultiplier(next.workerPercent)).toBeGreaterThan(
      recruitmentBonusMultiplier(current.workerPercent),
    );
  });
});

describe('stackRecruitmentContributions', () => {
  it('weights highest contributions first', () => {
    expect(stackRecruitmentContributions([10, 20, 5])).toBe(20 + 10 * 0.35 + 5 * 0.18);
  });
});
