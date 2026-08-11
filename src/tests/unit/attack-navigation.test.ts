import { describe, it, expect } from 'vitest';
import { evaluateAttackTargetPreview } from '@/lib/game-engine/combat/eligibility';
import { isWithinAttackRange, minAttackTargetNetWorth } from '@/config/game/redlite-rules';
import { GAMEPLAY_CONTEXT_MESSAGES } from '@/lib/game-engine/gameplay-errors';

describe('attack target preview', () => {
  const base = {
    attackerId: 'a1',
    defenderId: 'd1',
    attackerDistrictId: 'city-a',
    defenderDistrictId: 'city-a',
    attackerNw: 1_000_000,
    defenderNw: 5_000_000,
    defenderLifeStatus: 'ACTIVE',
    defenderTravelling: false,
    attacksOnTargetLast24h: 0,
    defenderOfflineProtected: false,
  };

  it('excludes self conceptually via invalid target code', () => {
    const preview = evaluateAttackTargetPreview({ ...base, attackerId: 'same', defenderId: 'same' });
    expect(preview.eligible).toBe(false);
    expect(preview.code).toBe('INVALID_TARGET');
  });

  it('rejects different city targets', () => {
    const preview = evaluateAttackTargetPreview({
      ...base,
      defenderDistrictId: 'city-b',
    });
    expect(preview.eligible).toBe(false);
    expect(preview.code).toBe('TARGET_WRONG_DISTRICT');
  });

  it('rejects below 50% net worth floor', () => {
    expect(isWithinAttackRange(1_000_000, 400_000)).toBe(false);
    const preview = evaluateAttackTargetPreview({ ...base, defenderNw: 400_000 });
    expect(preview.code).toBe('TARGET_OUT_OF_RANGE');
  });

  it('allows richer targets without maximum cap', () => {
    expect(isWithinAttackRange(1_000_000, 50_000_000)).toBe(true);
    const preview = evaluateAttackTargetPreview({ ...base, defenderNw: 50_000_000 });
    expect(preview.eligible).toBe(true);
  });

  it('surfaces offline protection state', () => {
    const preview = evaluateAttackTargetPreview({
      ...base,
      defenderOfflineProtected: true,
    });
    expect(preview.code).toBe('OFFLINE_PROTECTION_ACTIVE');
  });

  it('surfaces attack cap state', () => {
    const preview = evaluateAttackTargetPreview({
      ...base,
      attacksOnTargetLast24h: 20,
    });
    expect(preview.code).toBe('ATTACK_CAP_REACHED');
  });
});

describe('intel city rules', () => {
  it('documents intel wrong-district message', () => {
    expect(GAMEPLAY_CONTEXT_MESSAGES.intelWrongDistrict).toMatch(/same city/i);
  });

  it('documents stale attack wrong-district message', () => {
    expect(GAMEPLAY_CONTEXT_MESSAGES.targetNoLongerInCity).toMatch(/no longer in your city/i);
  });
});

describe('attack range floor helper', () => {
  it('uses 50% attacker net worth minimum', () => {
    expect(minAttackTargetNetWorth(1_000_000)).toBe(500_000);
  });
});
