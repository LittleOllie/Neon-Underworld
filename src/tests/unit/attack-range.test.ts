import { describe, it, expect } from 'vitest';
import {
  minAttackTargetNetWorth,
  maxAttackTargetNetWorth,
  isWithinAttackRange,
  attackRangeViolation,
} from '@/config/game/redlite-rules';
import {
  evaluateAttackTargetPreview,
  resolveProfileAttackEligibility,
  validateAttackEligibilityCode,
  attackRangeErrorMessage,
} from '@/lib/game-engine/combat/eligibility';

const ATTACKER_NW = 1_000_000;
const previewBase = {
  attackerId: 'a1',
  defenderId: 'd1',
  attackerDistrictId: 'city-a',
  defenderDistrictId: 'city-a',
  attackerNw: ATTACKER_NW,
  defenderLifeStatus: 'ACTIVE',
  defenderTravelling: false,
  attacksOnTargetLast24h: 0,
};

describe('canonical 60%–170% attack range', () => {
  it('computes Herman-scale bounds with ceil/floor rounding', () => {
    const hermanNw = 44_941;
    expect(minAttackTargetNetWorth(hermanNw)).toBe(26_965);
    expect(maxAttackTargetNetWorth(hermanNw)).toBe(76_399);
  });

  it('rejects 59.9% target', () => {
    expect(isWithinAttackRange(ATTACKER_NW, 599_999)).toBe(false);
    expect(attackRangeViolation(ATTACKER_NW, 599_999)).toBe('below');
  });

  it('accepts 60% target', () => {
    expect(isWithinAttackRange(ATTACKER_NW, 600_000)).toBe(true);
  });

  it('accepts 100% and 170% targets', () => {
    expect(isWithinAttackRange(ATTACKER_NW, 1_000_000)).toBe(true);
    expect(isWithinAttackRange(ATTACKER_NW, 1_700_000)).toBe(true);
  });

  it('rejects above 170%', () => {
    expect(isWithinAttackRange(ATTACKER_NW, 1_700_001)).toBe(false);
    expect(attackRangeViolation(ATTACKER_NW, 1_700_001)).toBe('above');
  });

  it('preview and execution agree on in-band target', () => {
    const preview = evaluateAttackTargetPreview({ ...previewBase, defenderNw: 1_000_000 });
    expect(preview.eligible).toBe(true);
    expect(
      validateAttackEligibilityCode({
        attackerId: 'a1',
        defenderId: 'd1',
        attackerDistrictId: 'city-a',
        defenderDistrictId: 'city-a',
        attackType: 'HOME_INVASION',
        attackingThugs: 50,
        attackerNw: ATTACKER_NW,
        defenderNw: 1_000_000,
        attackerTurns: 100,
        attackerThugs: 200,
        attackerRides: 20,
        attackerLifeStatus: 'ACTIVE',
        attackerTravelling: false,
        defenderLifeStatus: 'ACTIVE',
        defenderTravelling: false,
        intelReport: null,
        allowDirectAttack: true,
        attacksOnTargetLast24h: 0,
      }),
    ).toBeNull();
  });

  it('preview and execution reject out-of-band targets', () => {
    const below = evaluateAttackTargetPreview({ ...previewBase, defenderNw: 599_999 });
    expect(below.eligible).toBe(false);
    expect(below.code).toBe('TARGET_OUT_OF_RANGE');

    const above = evaluateAttackTargetPreview({ ...previewBase, defenderNw: 1_700_001 });
    expect(above.eligible).toBe(false);
    expect(above.code).toBe('TARGET_OUT_OF_RANGE');
  });

  it('profile eligibility distinguishes below and above band', () => {
    const below = resolveProfileAttackEligibility({
      viewerId: 'a1',
      viewerDistrictId: 'city-a',
      viewerNw: ATTACKER_NW,
      targetPlayerId: 'd1',
      targetDistrictId: 'city-a',
      targetNw: 599_999,
      targetLifeStatus: 'ACTIVE',
      targetTravelling: false,
    });
    expect(below.status).toBe('below_range');

    const above = resolveProfileAttackEligibility({
      viewerId: 'a1',
      viewerDistrictId: 'city-a',
      viewerNw: ATTACKER_NW,
      targetPlayerId: 'd1',
      targetDistrictId: 'city-a',
      targetNw: 1_700_001,
      targetLifeStatus: 'ACTIVE',
      targetTravelling: false,
    });
    expect(above.status).toBe('above_range');
  });

  it('execution uses stale-range message', () => {
    expect(attackRangeErrorMessage(ATTACKER_NW, 599_999, 'execution')).toMatch(/now outside/i);
    expect(attackRangeErrorMessage(ATTACKER_NW, 1_700_001, 'execution')).toMatch(/now outside/i);
  });

  it('intel uses directional messages', () => {
    expect(attackRangeErrorMessage(ATTACKER_NW, 599_999, 'intel')).toMatch(/below/i);
    expect(attackRangeErrorMessage(ATTACKER_NW, 1_700_001, 'intel')).toMatch(/above/i);
  });
});
