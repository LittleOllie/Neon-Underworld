import { describe, it, expect } from 'vitest';
import { resolveProduction } from '@/lib/game-engine/production';
import { isWithinAttackRange } from '@/lib/game-engine/combat-rules';
import { playerCashFromGross } from '@/lib/game-engine/worker-economics';

describe('production', () => {
  it('scales output with thugs and turns', () => {
    const low = resolveProduction({
      turnsSpent: 100,
      thugCount: 1,
      prostituteCount: 0,
      prostituteHappiness: 80,
      thugHappiness: 80,
      prostitutePayoutPercent: 50,
      drugType: 'hash',
      seed: 42,
    });
    const high = resolveProduction({
      turnsSpent: 100,
      thugCount: 10,
      prostituteCount: 0,
      prostituteHappiness: 80,
      thugHappiness: 80,
      prostitutePayoutPercent: 50,
      drugType: 'hash',
      seed: 42,
    });
    expect(high.drugUnitsProduced).toBeGreaterThan(low.drugUnitsProduced);
  });

  it('produces nothing without thugs', () => {
    const result = resolveProduction({
      turnsSpent: 100,
      thugCount: 0,
      prostituteCount: 5,
      prostituteHappiness: 80,
      thugHappiness: 80,
      prostitutePayoutPercent: 50,
      drugType: 'hash',
      seed: 1,
    });
    expect(result.drugUnitsProduced).toBe(0);
  });

  it('produces less at low thug happiness', () => {
    const high = resolveProduction({
      turnsSpent: 100,
      thugCount: 10,
      prostituteCount: 0,
      prostituteHappiness: 80,
      thugHappiness: 95,
      prostitutePayoutPercent: 50,
      drugType: 'hash',
      seed: 42,
    });
    const low = resolveProduction({
      turnsSpent: 100,
      thugCount: 10,
      prostituteCount: 0,
      prostituteHappiness: 80,
      thugHappiness: 25,
      prostitutePayoutPercent: 50,
      drugType: 'hash',
      seed: 42,
    });
    expect(high.drugUnitsProduced).toBeGreaterThan(low.drugUnitsProduced);
  });
});

describe('Redlite attack range', () => {
  it('allows targets at or above 50% of attacker net worth with no upper cap', () => {
    expect(isWithinAttackRange(100_000_000, 50_000_000)).toBe(true);
    expect(isWithinAttackRange(100_000_000, 200_000_000)).toBe(true);
    expect(isWithinAttackRange(100_000_000, 1_000_000_000)).toBe(true);
    expect(isWithinAttackRange(100_000_000, 30_000_000)).toBe(false);
    expect(isWithinAttackRange(100_000_000, 49_999_999)).toBe(false);
  });
});

describe('Redlite payout cash split', () => {
  it('keeps more cash at low payout', () => {
    expect(playerCashFromGross(10000, 1)).toBe(9900);
    expect(playerCashFromGross(10000, 100)).toBe(0);
    expect(playerCashFromGross(10000, 50)).toBe(5000);
  });
});
