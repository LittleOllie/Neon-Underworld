import { describe, it, expect } from 'vitest';
import {
  computeCartelResponseForce,
  CARTEL_RESPONSE_PERSONAL_MIN_ALLOWANCE,
  CARTEL_RESPONSE_POOL_SHARE,
  CARTEL_THUGS_PER_RIDE,
} from '@/lib/game-engine/cartel-response-force';
import { cartelDefenceThugBonus } from '@/lib/game-engine/cartel-economics';
import { deriveCombatSeed, resolveCombat } from '@/lib/game-engine/combat/resolve-combat';
import { allocateWeaponsForThugs } from '@/lib/game-engine/combat/weapon-allocation';

describe('computeCartelResponseForce', () => {
  it('uses personal allowance = max(25, personal × 2) when it is the binding cap', () => {
    expect(computeCartelResponseForce(0, 20_000, 4000)).toBe(25);
    expect(computeCartelResponseForce(1, 20_000, 4000)).toBe(25);
    expect(computeCartelResponseForce(10, 20_000, 4000)).toBe(25);
    expect(computeCartelResponseForce(50, 20_000, 4000)).toBe(100);
    expect(computeCartelResponseForce(500, 20_000, 4000)).toBe(1000);
    expect(computeCartelResponseForce(5000, 20_000, 4000)).toBe(5000);
  });

  it('respects 25% share cap on small pools (minimum allowance is not guaranteed)', () => {
    expect(computeCartelResponseForce(50, 12, 100)).toBe(3);
    expect(computeCartelResponseForce(0, 12, 100)).toBe(3);
  });

  it('cannot deploy more than the current cartel pool', () => {
    expect(computeCartelResponseForce(10, 8, 100)).toBe(2);
  });

  it('applies 25% cartel share cap on current pool', () => {
    expect(computeCartelResponseForce(5000, 40, 100)).toBe(10);
    expect(computeCartelResponseForce(5000, 100, 100)).toBe(25);
    expect(computeCartelResponseForce(5000, 1000, 500)).toBe(250);
    expect(computeCartelResponseForce(5000, 20_000, 5000)).toBe(5000);
  });

  it('limits by ride transport capacity', () => {
    expect(computeCartelResponseForce(5000, 20_000, 0)).toBe(0);
    expect(computeCartelResponseForce(5000, 20_000, 1)).toBe(CARTEL_THUGS_PER_RIDE);
    expect(computeCartelResponseForce(50, 20_000, 10)).toBe(50);
    expect(computeCartelResponseForce(5000, 20_000, 20)).toBe(100);
    expect(computeCartelResponseForce(5000, 20_000, 1000)).toBe(5000);
  });

  it('returns lowest applicable constraint (approved examples)', () => {
    expect(computeCartelResponseForce(50, 20_000, 4000)).toBe(100);
    expect(computeCartelResponseForce(50, 20_000, 10)).toBe(50);
    expect(computeCartelResponseForce(5000, 20_000, 1000)).toBe(5000);
    expect(computeCartelResponseForce(50, 20_000, 0)).toBe(0);
    expect(computeCartelResponseForce(50, 40, 100)).toBe(10);
  });

  it('documents share cap constant', () => {
    expect(CARTEL_RESPONSE_POOL_SHARE).toBe(0.25);
  });
});

describe('cartel local support', () => {
  it('grants 10% of supporter thugs as virtual bonus', () => {
    expect(cartelDefenceThugBonus([{ thugs: 100 }, { thugs: 40 }])).toBe(14);
    expect(cartelDefenceThugBonus([])).toBe(0);
  });
});

describe('cartel response combat integration', () => {
  const baseAttacker = {
    thugs: 200,
    glocks: 0,
    uzis: 0,
    aks: 200,
    cash: 0,
    drugs: { hash: 0, shrooms: 0, coke: 0, heroin: 0 },
  };
  const baseDefender = {
    thugs: 20,
    glocks: 10,
    uzis: 0,
    aks: 0,
    cash: 0,
    drugs: { hash: 0, shrooms: 0, coke: 0, heroin: 0 },
  };

  it('deploys capped cartel thugs with partial weapon allocation', () => {
    const deployed = 50;
    const seed = deriveCombatSeed('a', 'd', 'partial-weapons');
    const result = resolveCombat({
      attackType: 'DRIVE_BY',
      attackingThugs: 100,
      seed,
      cartelArmoury: { thugs: deployed, glocks: 10, uzis: 5 },
      attacker: baseAttacker,
      defender: baseDefender,
    });

    expect(result.defenderForceSnapshot.cartelArmouryThugs).toBe(deployed);
    const alloc = allocateWeaponsForThugs(deployed, { glocks: 10, uzis: 5, aks: 0 });
    expect(result.defenderForceSnapshot.cartelArmouryAllocation).toEqual(alloc);
    expect(result.cartelThugLosses).toBeLessThanOrEqual(deployed);
    expect(result.defenderLosses).toBeLessThanOrEqual(baseDefender.thugs);
  });

  it('virtual local support adds force without cartel casualties', () => {
    const seed = deriveCombatSeed('a', 'd', 'local-support');
    const result = resolveCombat({
      attackType: 'DRIVE_BY',
      attackingThugs: 50,
      seed,
      cartelSupportThugs: 14,
      cartelArmoury: { thugs: 0, glocks: 0, uzis: 0 },
      attacker: baseAttacker,
      defender: baseDefender,
    });
    expect(result.defenderForceSnapshot.cartelSupportThugs).toBe(14);
    expect(result.cartelThugLosses).toBe(0);
  });
});
