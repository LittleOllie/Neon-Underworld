import { describe, expect, it } from 'vitest';
import {
  calculateEmpireRecruitmentMultipliers,
  computeEmpireFactor,
  EMPIRE_RECRUITMENT_CONFIG,
} from '@/config/game/empire-recruitment-rules';
import { resolveScouting } from '@/lib/game-engine/scouting';
import { DISTRICTS } from '@/config/game/balance';

const neon = DISTRICTS.find((d) => d.slug === 'neon-strip')!.modifiers;

describe('empire recruitment multipliers', () => {
  it('uses approved canonical base scales and empire cap', () => {
    expect(EMPIRE_RECRUITMENT_CONFIG.baseWorkerScale).toBe(1.55);
    expect(EMPIRE_RECRUITMENT_CONFIG.baseThugScale).toBe(1.48);
    expect(EMPIRE_RECRUITMENT_CONFIG.maxEmpireFactor).toBe(3.0);
  });

  it('returns modest multiplier for fresh player with no businesses', () => {
    const m = calculateEmpireRecruitmentMultipliers({
      businesses: [],
      workers: 5,
      thugs: 3,
      assignedWorkers: 0,
    });
    expect(m.workerMultiplier).toBeGreaterThan(1.45);
    expect(m.workerMultiplier).toBeLessThan(1.65);
    expect(m.thugMultiplier).toBeGreaterThan(1.4);
    expect(m.thugMultiplier).toBeLessThan(1.6);
    expect(m.strengthBand).toBe('STREET');
  });

  it('increases smoothly as businesses and crew grow', () => {
    const early = calculateEmpireRecruitmentMultipliers({
      businesses: [{ businessType: 'NIGHTCLUB', level: 1 }],
      workers: 80,
      thugs: 50,
      assignedWorkers: 40,
    });
    const mid = calculateEmpireRecruitmentMultipliers({
      businesses: [
        { businessType: 'WAREHOUSE', level: 3 },
        { businessType: 'NIGHTCLUB', level: 2 },
      ],
      workers: 800,
      thugs: 450,
      assignedWorkers: 600,
    });
    expect(mid.workerMultiplier).toBeGreaterThan(early.workerMultiplier * 1.5);
    expect(mid.workerMultiplier).toBeLessThan(early.workerMultiplier * 6);
  });

  it('caps empire factor', () => {
    const elite = calculateEmpireRecruitmentMultipliers({
      businesses: Array.from({ length: 8 }, () => ({ businessType: 'WAREHOUSE' as const, level: 5 })),
      workers: 20_000,
      thugs: 15_000,
      assignedWorkers: 12_000,
    });
    expect(elite.empireFactor).toBeLessThanOrEqual(EMPIRE_RECRUITMENT_CONFIG.maxEmpireFactor + 0.01);
  });

  it('does not change scout cash when recruitment multipliers increase', () => {
    const baseInput = {
      turnsSpent: 50,
      districtModifiers: neon,
      areaSlug: 'clubs',
      prostituteHappiness: 80,
      thugHappiness: 80,
      prostituteCount: 100,
      thugCount: 50,
      prostitutePayoutPercent: 50,
      seed: 12_345,
    };
    const baseline = resolveScouting(baseInput);
    const boosted = resolveScouting({
      ...baseInput,
      businessNetwork: {
        workerMultiplier: 8,
        thugMultiplier: 6,
        workerBonusPercent: 200,
        thugBonusPercent: 150,
      },
    });
    expect(boosted.cashEarned).toBe(baseline.cashEarned);
  });
});

describe('computeEmpireFactor smoothing', () => {
  it('increases monotonically with staffed workers', () => {
    const base = {
      businesses: [{ businessType: 'WAREHOUSE', level: 2 }],
      workers: 200,
      thugs: 100,
      assignedWorkers: 0,
    };
    const f0 = computeEmpireFactor(base, 500).combined;
    const f1 = computeEmpireFactor({ ...base, assignedWorkers: 250 }, 500).combined;
    const f2 = computeEmpireFactor({ ...base, assignedWorkers: 500 }, 500).combined;
    expect(f1).toBeGreaterThanOrEqual(f0);
    expect(f2).toBeGreaterThanOrEqual(f1);
  });
});
