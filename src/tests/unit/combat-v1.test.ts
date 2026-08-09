import { describe, it, expect } from 'vitest';
import { ATTACK_RULES } from '@/config/game/attack-rules';
import { isWithinAttackRange, ridesRequiredForThugs } from '@/lib/game-engine/combat-rules';
import {
  validateAttackEligibility,
  isIntelReportValid,
  ridesRequired,
  type PlayerIntelSnapshot,
} from '@/lib/game-engine/combat/eligibility';
import { allocateWeaponsForThugs } from '@/lib/game-engine/combat/weapon-allocation';
import { resolveCombat, deriveCombatSeed } from '@/lib/game-engine/combat/resolve-combat';
import { resolveTheft } from '@/lib/game-engine/combat/theft';
import { createCombatRng } from '@/lib/game-engine/combat/combat-random';
import { buildPlayerIntelSnapshot } from '@/lib/game-engine/combat/build-intel-snapshot';

function intel(overrides: Partial<PlayerIntelSnapshot> = {}): PlayerIntelSnapshot {
  const now = new Date();
  const expires = new Date(now.getTime() + 48 * 60 * 60 * 1000);
  return {
    targetPlayerId: 'defender-1',
    targetAlias: 'Ghost',
    targetCity: 'Neon Strip',
    scoutedAt: now.toISOString(),
    expiresAt: expires.toISOString(),
    confidencePercent: 85,
    canonicalNetWorthAtScout: 1_000_000,
    estimatedThugs: 100,
    estimatedWeaponStrength: 500,
    estimatedCash: 50_000,
    estimatedDrugs: 200,
    cartelId: null,
    ...overrides,
  };
}

function baseEligibility(overrides: Partial<Parameters<typeof validateAttackEligibility>[0]> = {}) {
  return validateAttackEligibility({
    attackerId: 'attacker-1',
    defenderId: 'defender-1',
    attackType: 'HOME_INVASION',
    attackingThugs: 50,
    attackerNw: 1_000_000,
    defenderNw: 1_000_000,
    attackerTurns: 100,
    attackerThugs: 200,
    attackerRides: 20,
    attackerLifeStatus: 'ACTIVE',
    attackerTravelling: false,
    defenderLifeStatus: 'ACTIVE',
    defenderTravelling: false,
    intelReport: intel(),
    attacksOnTargetLast24h: 0,
    ...overrides,
  });
}

describe('Attack eligibility', () => {
  it('rejects self-attack', () => {
    expect(baseEligibility({ attackerId: 'same', defenderId: 'same' })).toMatch(/yourself/);
  });

  it('rejects below 0.5× net worth', () => {
    expect(baseEligibility({ defenderNw: 400_000 })).toMatch(/range/);
  });

  it('rejects above 2× net worth', () => {
    expect(baseEligibility({ defenderNw: 2_500_000 })).toMatch(/range/);
  });

  it('accepts exact lower boundary', () => {
    expect(baseEligibility({ defenderNw: 500_000 })).toBeNull();
  });

  it('accepts exact upper boundary', () => {
    expect(baseEligibility({ defenderNw: 2_000_000 })).toBeNull();
  });

  it('rejects expired scout report', () => {
    const expired = intel({
      expiresAt: new Date(Date.now() - 1000).toISOString(),
    });
    expect(isIntelReportValid(expired)).toBe(false);
    expect(baseEligibility({ intelReport: expired })).toMatch(/Scout/);
  });

  it('rejects missing scout report', () => {
    expect(baseEligibility({ intelReport: null })).toMatch(/Scout/);
  });

  it('rejects insufficient turns', () => {
    expect(baseEligibility({ attackerTurns: 1 })).toMatch(/turns/);
  });

  it('rejects travelling attacker', () => {
    expect(baseEligibility({ attackerTravelling: true })).toMatch(/travelling/);
  });

  it('rejects invalid target report mismatch', () => {
    expect(
      baseEligibility({
        defenderId: 'other',
        intelReport: intel({ targetPlayerId: 'defender-1' }),
      }),
    ).toMatch(/match/);
  });

  it('enforces attack cap', () => {
    expect(
      baseEligibility({ attacksOnTargetLast24h: ATTACK_RULES.targetAttackCapPer24h }),
    ).toMatch(/limit/);
  });
});

describe('Vehicle requirements', () => {
  it('1 thug requires 1 ride', () => {
    expect(ridesRequiredForThugs(1)).toBe(1);
    expect(ridesRequired(1)).toBe(1);
  });

  it('5 thugs requires 1 ride', () => {
    expect(ridesRequiredForThugs(5)).toBe(1);
  });

  it('6 thugs requires 2 rides', () => {
    expect(ridesRequiredForThugs(6)).toBe(2);
  });

  it('rejects insufficient rides via eligibility', () => {
    expect(baseEligibility({ attackingThugs: 6, attackerRides: 1 })).toMatch(/rides/);
  });
});

describe('Weapon allocation', () => {
  it('allocates strongest-first', () => {
    const alloc = allocateWeaponsForThugs(10, { glocks: 5, uzis: 3, aks: 2 });
    expect(alloc.aks).toBe(2);
    expect(alloc.uzis).toBe(3);
    expect(alloc.glocks).toBe(5);
    expect(alloc.armedThugs).toBe(10);
  });

  it('supports partial coverage', () => {
    const alloc = allocateWeaponsForThugs(20, { glocks: 3, uzis: 0, aks: 0 });
    expect(alloc.armedThugs).toBe(3);
    expect(alloc.unarmedThugs).toBe(17);
  });

  it('handles unarmed force', () => {
    const alloc = allocateWeaponsForThugs(5, { glocks: 0, uzis: 0, aks: 0 });
    expect(alloc.unarmedThugs).toBe(5);
  });

  it('does not consume weapons (inventory unchanged conceptually)', () => {
    const inventory = { glocks: 10, uzis: 5, aks: 2 };
    allocateWeaponsForThugs(100, inventory);
    expect(inventory.glocks).toBe(10);
  });
});

describe('Drive-By', () => {
  it('resolves casualties without theft', () => {
    const seed = deriveCombatSeed('a', 'd', 'key');
    const result = resolveCombat({
      attackType: 'DRIVE_BY',
      attackingThugs: 100,
      seed,
      attacker: { thugs: 100, glocks: 50, uzis: 20, aks: 10, cash: 0, drugs: { hash: 0, shrooms: 0, coke: 0, heroin: 0 } },
      defender: { thugs: 80, glocks: 20, uzis: 10, aks: 5, cash: 100_000, drugs: { hash: 100, shrooms: 0, coke: 0, heroin: 0 } },
    });
    expect(result.cashStolen).toBe(0);
    expect(result.drugsStolen).toEqual({ hash: 0, shrooms: 0, coke: 0, heroin: 0 });
    expect(result.attackerLosses).toBeGreaterThanOrEqual(0);
    expect(result.defenderLosses).toBeGreaterThanOrEqual(0);
  });
});

describe('Home Invasion theft', () => {
  it('steals only exposed cash', () => {
    const rng = createCombatRng(42);
    const theft = resolveTheft(
      'HOME_INVASION',
      true,
      true,
      100_000,
      { hash: 0, shrooms: 0, coke: 0, heroin: 0 },
      80,
      100,
      rng,
    );
    expect(theft.cashStolen).toBeGreaterThan(0);
    expect(theft.cashStolen).toBeLessThanOrEqual(100_000);
    expect(theft.drugsStolen).toEqual({ hash: 0, shrooms: 0, coke: 0, heroin: 0 });
  });

  it('failed invasion steals nothing', () => {
    const rng = createCombatRng(42);
    const theft = resolveTheft(
      'HOME_INVASION',
      false,
      false,
      100_000,
      { hash: 0, shrooms: 0, coke: 0, heroin: 0 },
      10,
      100,
      rng,
    );
    expect(theft.cashStolen).toBe(0);
  });
});

describe('Raid Drug Labs theft', () => {
  it('proportional drug theft', () => {
    const rng = createCombatRng(99);
    const theft = resolveTheft(
      'RAID_DRUG_LABS',
      true,
      true,
      0,
      { hash: 100, shrooms: 100, coke: 100, heroin: 100 },
      90,
      100,
      rng,
    );
    const total =
      theft.drugsStolen.hash +
      theft.drugsStolen.shrooms +
      theft.drugsStolen.coke +
      theft.drugsStolen.heroin;
    expect(total).toBeGreaterThan(0);
    expect(total).toBeLessThanOrEqual(400);
  });

  it('failed raid steals nothing', () => {
    const rng = createCombatRng(1);
    const theft = resolveTheft(
      'RAID_DRUG_LABS',
      false,
      false,
      0,
      { hash: 500, shrooms: 0, coke: 0, heroin: 0 },
      5,
      100,
      rng,
    );
    expect(theft.drugsStolen).toEqual({ hash: 0, shrooms: 0, coke: 0, heroin: 0 });
  });
});

describe('Economy conservation', () => {
  it('cash theft cannot exceed defender cash', () => {
    const rng = createCombatRng(7);
    const theft = resolveTheft('HOME_INVASION', true, true, 1000, { hash: 0, shrooms: 0, coke: 0, heroin: 0 }, 50, 50, rng);
    expect(theft.cashStolen).toBeLessThanOrEqual(1000);
  });

  it('intel snapshot uses noise but preserves structure', () => {
    const snap = buildPlayerIntelSnapshot(
      {
        id: 't1',
        alias: 'Ghost',
        districtName: 'Strip',
        thugs: 100,
        glocks: 10,
        uzis: 5,
        aks: 2,
        cash: 50_000,
        hash: 20,
        shrooms: 0,
        coke: 0,
        heroin: 0,
        cartelId: null,
        canonicalNetWorth: 1_000_000,
      },
      12345,
    );
    expect(snap.targetPlayerId).toBe('t1');
    expect(snap.estimatedThugs).toBeGreaterThan(0);
  });
});

describe('Attack range helper', () => {
  it('matches redlite 0.5×–2× rule', () => {
    expect(isWithinAttackRange(1_000_000, 500_000)).toBe(true);
    expect(isWithinAttackRange(1_000_000, 2_000_000)).toBe(true);
    expect(isWithinAttackRange(1_000_000, 499_999)).toBe(false);
  });
});
