import { describe, it, expect } from 'vitest';
import { evaluateAttackTargetPreview } from '@/lib/game-engine/combat/eligibility';
import { isWithinAttackRange, minAttackTargetNetWorth, maxAttackTargetNetWorth } from '@/config/game/redlite-rules';
import { GAMEPLAY_CONTEXT_MESSAGES } from '@/lib/game-engine/gameplay-errors';

describe('attack target preview', () => {
  const base = {
    attackerId: 'a1',
    defenderId: 'd1',
    attackerDistrictId: 'city-a',
    defenderDistrictId: 'city-a',
    attackerNw: 1_000_000,
    defenderNw: 1_000_000,
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

  it('rejects below 60% net worth floor', () => {
    expect(isWithinAttackRange(1_000_000, 400_000)).toBe(false);
    const preview = evaluateAttackTargetPreview({ ...base, defenderNw: 400_000 });
    expect(preview.code).toBe('TARGET_OUT_OF_RANGE');
  });

  it('rejects above 170% net worth ceiling', () => {
    expect(isWithinAttackRange(1_000_000, 50_000_000)).toBe(false);
    const preview = evaluateAttackTargetPreview({ ...base, defenderNw: 50_000_000 });
    expect(preview.code).toBe('TARGET_OUT_OF_RANGE');
  });

  it('allows in-band richer targets', () => {
    expect(isWithinAttackRange(1_000_000, 1_500_000)).toBe(true);
    const preview = evaluateAttackTargetPreview({ ...base, defenderNw: 1_500_000 });
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
  it('uses 60% attacker net worth minimum', () => {
    expect(minAttackTargetNetWorth(1_000_000)).toBe(600_000);
  });

  it('uses 170% attacker net worth maximum', () => {
    expect(maxAttackTargetNetWorth(1_000_000)).toBe(1_700_000);
  });
});
