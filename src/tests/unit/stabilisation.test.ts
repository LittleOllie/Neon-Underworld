import { describe, it, expect } from 'vitest';
import {
  calculateDepartureRisk,
  happinessEfficiencyModifier,
} from '@/lib/game-engine/happiness';
import { resolveProduction } from '@/lib/game-engine/production';
import { resolveScouting } from '@/lib/game-engine/scouting';
import { createSeededRng } from '@/lib/game-engine/rng';
import { GameplayError, toUserMessage } from '@/lib/game-engine/gameplay-errors';
import { evaluateAttackTargetPreview } from '@/lib/game-engine/combat/eligibility';

describe('happiness efficiency', () => {
  it('returns full efficiency at 100% happiness', () => {
    expect(happinessEfficiencyModifier(100)).toBe(1);
  });

  it('returns reduced efficiency at moderate happiness', () => {
    const mod = happinessEfficiencyModifier(65);
    expect(mod).toBeGreaterThan(0.8);
    expect(mod).toBeLessThan(1);
  });

  it('returns lower efficiency at low happiness', () => {
    expect(happinessEfficiencyModifier(25)).toBeLessThan(happinessEfficiencyModifier(65));
  });

  it('clamps scores outside 0–100', () => {
    expect(happinessEfficiencyModifier(-5)).toBe(happinessEfficiencyModifier(0));
    expect(happinessEfficiencyModifier(150)).toBe(happinessEfficiencyModifier(100));
  });
});

describe('walkouts', () => {
  it('has no walkout at healthy morale', () => {
    const result = calculateDepartureRisk(250, 85, 85, 20, 20);
    expect(result.prostitutesLost).toBe(0);
    expect(result.thugsLost).toBe(0);
  });

  it('can lose crew at critical morale with deterministic rng', () => {
    const rng = createSeededRng(999);
    const result = calculateDepartureRisk(250, 15, 15, 20, 20, rng);
    expect(result.prostitutesLost + result.thugsLost).toBeGreaterThan(0);
  });

  it('never returns negative walkouts', () => {
    const rng = createSeededRng(1);
    const result = calculateDepartureRisk(500, 10, 10, 5, 5, rng);
    expect(result.prostitutesLost).toBeGreaterThanOrEqual(0);
    expect(result.thugsLost).toBeGreaterThanOrEqual(0);
    expect(result.prostitutesLost).toBeLessThanOrEqual(5);
    expect(result.thugsLost).toBeLessThanOrEqual(5);
  });
});

describe('scout and produce happiness effects', () => {
  it('scout cash scales with crew happiness', () => {
    const base = {
      turnsSpent: 50,
      districtModifiers: {
        prostituteRecruitment: 1,
        thugRecruitment: 1,
        resultConsistency: 1,
        descriptionTag: 'test',
      },
      prostituteCount: 10,
      thugCount: 5,
      prostitutePayoutPercent: 50,
      seed: 77,
    };
    const high = resolveScouting({ ...base, prostituteHappiness: 95, thugHappiness: 95 });
    const low = resolveScouting({ ...base, prostituteHappiness: 30, thugHappiness: 30 });
    expect(high.cashEarned).toBeGreaterThan(low.cashEarned);
  });

  it('includes walkout messaging in production summary', () => {
    const rng = createSeededRng(4242);
    const result = resolveProduction({
      turnsSpent: 300,
      thugCount: 10,
      prostituteCount: 10,
      prostituteHappiness: 15,
      thugHappiness: 15,
      prostitutePayoutPercent: 50,
      drugType: 'hash',
      seed: 4242,
    });
    if (result.prostitutesLost + result.thugsLost > 0) {
      expect(result.summary).toMatch(/walked out because morale became critically low/i);
    }
  });
});

describe('attack error messages', () => {
  it('maps gameplay errors to player-safe messages', () => {
    expect(toUserMessage(new GameplayError('INSUFFICIENT_RIDES'))).toBe(
      "You don't have enough rides for this.",
    );
    expect(toUserMessage(new GameplayError('TARGET_OUT_OF_RANGE'))).toBe(
      'That player is below your attack range.',
    );
  });

  it('maps turn state failures to a useful message', () => {
    expect(toUserMessage(new Error('Turn state missing'))).toMatch(/not ready for combat/i);
  });
});

describe('attack target preview', () => {
  it('blocks targets below minimum net worth', () => {
    const preview = evaluateAttackTargetPreview({
      attackerId: 'a1',
      defenderId: 'd1',
      attackerDistrictId: 'dist1',
      defenderDistrictId: 'dist1',
      attackerNw: 200_000,
      defenderNw: 99_999,
      defenderLifeStatus: 'ACTIVE',
      defenderTravelling: false,
      attacksOnTargetLast24h: 0,
    });
    expect(preview.eligible).toBe(false);
    expect(preview.code).toBe('TARGET_OUT_OF_RANGE');
  });

  it('allows vastly richer targets', () => {
    const preview = evaluateAttackTargetPreview({
      attackerId: 'a1',
      defenderId: 'd1',
      attackerDistrictId: 'dist1',
      defenderDistrictId: 'dist1',
      attackerNw: 200_000,
      defenderNw: 10_000_000,
      defenderLifeStatus: 'ACTIVE',
      defenderTravelling: false,
      attacksOnTargetLast24h: 0,
    });
    expect(preview.eligible).toBe(true);
  });
});
