import { describe, it, expect } from 'vitest';
import {
  WORKER_POACHING_RULES,
  happinessPoachMultiplier,
  protectionPoachMultiplier,
  capPoachedWorkers,
  workforceProtectionBand,
} from '@/config/game/worker-poaching-rules';
import { resolveWorkerPoach } from '@/lib/game-engine/combat/worker-poach';
import { createCombatRng } from '@/lib/game-engine/combat/combat-random';
import {
  validateAttackEligibilityCode,
  isIntelReportValid,
  type PlayerIntelSnapshot,
} from '@/lib/game-engine/combat/eligibility';
import { isDamagingAttackResult } from '@/lib/game-engine/combat/offline-protection';
import { resolveCombat, deriveCombatSeed } from '@/lib/game-engine/combat/resolve-combat';
import { buildDeepIntelSnapshot } from '@/lib/game-engine/combat/deep-intel';
import { computePoachingOutlook } from '@/lib/game-engine/combat/poach-outlook';
import { workforceStabilityBand } from '@/lib/game-engine/combat/intel-bands';
import { calculateCanonicalNetWorthFromPlayer } from '@/lib/game-engine/canonical-net-worth';
import { CANONICAL_NET_WORTH_VALUATIONS } from '@/lib/game-engine/canonical-net-worth';

function intel(overrides: Partial<PlayerIntelSnapshot> = {}): PlayerIntelSnapshot {
  const now = new Date();
  return {
    targetPlayerId: 'defender-1',
    targetAlias: 'Ghost',
    targetCity: 'Neon Strip',
    scoutedAt: now.toISOString(),
    expiresAt: new Date(now.getTime() + 48 * 60 * 60 * 1000).toISOString(),
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

function baseEligibility(overrides: Partial<Parameters<typeof validateAttackEligibilityCode>[0]> = {}) {
  return validateAttackEligibilityCode({
    attackerId: 'attacker-1',
    defenderId: 'defender-1',
    attackerDistrictId: 'district-1',
    defenderDistrictId: 'district-1',
    attackType: 'POACH_WORKERS',
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
    defenderWorkers: 500,
    ...overrides,
  });
}

describe('Worker poaching eligibility', () => {
  it('rejects cross-city poach', () => {
    expect(
      baseEligibility({ attackerDistrictId: 'district-1', defenderDistrictId: 'district-2' }),
    ).toBe('TARGET_WRONG_DISTRICT');
  });

  it('requires valid intel', () => {
    expect(baseEligibility({ intelReport: null })).toBe('EXPIRED_INTEL');
    const expired = intel({ expiresAt: new Date(Date.now() - 1000).toISOString() });
    expect(isIntelReportValid(expired)).toBe(false);
    expect(baseEligibility({ intelReport: expired })).toBe('EXPIRED_INTEL');
  });

  it('rejects NW out of range', () => {
    expect(baseEligibility({ defenderNw: 400_000 })).toBe('TARGET_OUT_OF_RANGE');
  });

  it('enforces 24h attack cap', () => {
    expect(baseEligibility({ attacksOnTargetLast24h: 20 })).toBe('ATTACK_CAP_REACHED');
  });

  it('blocks offline protection', () => {
    expect(baseEligibility({ defenderOfflineProtected: true })).toBe('OFFLINE_PROTECTION_ACTIVE');
  });

  it('blocks targets with too few workers', () => {
    expect(baseEligibility({ defenderWorkers: 24 })).toBe('POACH_TARGET_TOO_SMALL');
    expect(baseEligibility({ defenderWorkers: 25 })).toBeNull();
  });
});

describe('Worker poach modifiers', () => {
  it('reduces poaching at high happiness', () => {
    expect(happinessPoachMultiplier(90)).toBeLessThan(happinessPoachMultiplier(50));
    expect(happinessPoachMultiplier(15)).toBeGreaterThan(happinessPoachMultiplier(50));
  });

  it('reduces poaching with strong thug protection ratio', () => {
    expect(protectionPoachMultiplier(0.8)).toBeLessThan(protectionPoachMultiplier(0.05));
  });

  it('caps small players', () => {
    expect(capPoachedWorkers(5, 40)).toBe(1);
    expect(capPoachedWorkers(5, 80)).toBe(2);
    expect(capPoachedWorkers(50, 1000)).toBe(30);
  });

  it('enforces 3% hard cap', () => {
    const stolen = capPoachedWorkers(999, 1000);
    expect(stolen).toBeLessThanOrEqual(30);
  });
});

describe('resolveWorkerPoach', () => {
  it('returns zero on failed attack', () => {
    const rng = createCombatRng(1);
    expect(
      resolveWorkerPoach({
        attackerVictory: false,
        tacticalSuccess: false,
        defenderWorkers: 1000,
        defenderThugsForProtection: 100,
        workerHappiness: 30,
        survivingAttackers: 0,
        attackingThugs: 200,
        rng,
      }).workersStolen,
    ).toBe(0);
  });

  it('transfers workers on success without exceeding cap', () => {
    const rng = createCombatRng(99);
    const result = resolveWorkerPoach({
      attackerVictory: true,
      tacticalSuccess: true,
      defenderWorkers: 1000,
      defenderThugsForProtection: 100,
      workerHappiness: 25,
      survivingAttackers: 150,
      attackingThugs: 200,
      rng,
    });
    expect(result.workersStolen).toBeGreaterThan(0);
    expect(result.workersStolen).toBeLessThanOrEqual(30);
  });

  it('is deterministic for the same seed', () => {
    const input = {
      attackerVictory: true,
      tacticalSuccess: true,
      defenderWorkers: 500,
      defenderThugsForProtection: 50,
      workerHappiness: 40,
      survivingAttackers: 120,
      attackingThugs: 150,
      rng: createCombatRng(12345),
    };
    const a = resolveWorkerPoach(input);
    const b = resolveWorkerPoach({ ...input, rng: createCombatRng(12345) });
    expect(a).toEqual(b);
  });
});

describe('resolveCombat POACH_WORKERS integration', () => {
  it('does not create workers on failed poach', () => {
    const seed = deriveCombatSeed('a', 'd', 'fail-poach');
    const combat = resolveCombat({
      attackType: 'POACH_WORKERS',
      attackingThugs: 10,
      seed,
      attacker: {
        thugs: 500,
        glocks: 0,
        uzis: 0,
        aks: 0,
        cash: 0,
        drugs: { hash: 0, shrooms: 0, coke: 0, heroin: 0 },
      },
      defender: {
        thugs: 2000,
        glocks: 200,
        uzis: 100,
        aks: 50,
        cash: 0,
        drugs: { hash: 0, shrooms: 0, coke: 0, heroin: 0 },
      },
      poachContext: {
        defenderWorkers: 1000,
        defenderThugsForProtection: 2000,
        workerHappiness: 80,
      },
    });
    expect(combat.workersStolen).toBe(0);
    expect(combat.outcome).toBe('REPULSED');
  });

  it('counts worker theft as damaging for offline protection', () => {
    expect(
      isDamagingAttackResult({
        defenderLosses: 0,
        cartelThugLosses: 0,
        cashStolen: 0,
        drugsStolen: { hash: 0, shrooms: 0, coke: 0, heroin: 0 },
        workersStolen: 5,
      }),
    ).toBe(true);
  });
});

describe('Deep intel poaching bands', () => {
  const baseTarget = {
    id: 'target-1',
    alias: 'Ghost',
    districtName: 'Neon Strip',
    thugs: 100,
    prostitutes: 1000,
    glocks: 10,
    uzis: 5,
    aks: 2,
    cash: 100_000,
    hash: 1000,
    shrooms: 0,
    coke: 0,
    heroin: 0,
    cartelId: null,
    canonicalNetWorth: 2_000_000,
    condoms: 500,
    prostitutePayoutPercent: 40,
  };

  it('does not leak exact happiness in snapshot', () => {
    const snapshot = buildDeepIntelSnapshot(baseTarget, 'scout-1', 'poach-key');
    expect(Object.keys(snapshot)).not.toContain('workerHappiness');
    expect(Object.keys(snapshot)).not.toContain('prostitutes');
    expect(snapshot.workforceStabilityBand).toBeTruthy();
    expect(snapshot.workforceProtectionBand).toBeTruthy();
    expect(snapshot.poachingOutlook).toBeTruthy();
  });

  it('shows worse outlook for unhappy low-protection targets', () => {
    const unhappy = buildDeepIntelSnapshot(
      { ...baseTarget, thugs: 50, hash: 0, condoms: 0, prostitutePayoutPercent: 10 },
      'scout-1',
      'unhappy-key',
    );
    const stable = buildDeepIntelSnapshot(
      { ...baseTarget, thugs: 900, hash: 5000, condoms: 5000, prostitutePayoutPercent: 60 },
      'scout-1',
      'stable-key',
    );
    const outlookRank = (o: string) =>
      ['Poor', 'Risky', 'Possible', 'Promising', 'Highly Vulnerable'].indexOf(o);
    expect(outlookRank(unhappy.poachingOutlook)).toBeGreaterThan(outlookRank(stable.poachingOutlook));
  });

  it('computes outlook from bands only', () => {
    const outlook = computePoachingOutlook({
      workforceStabilityBand: 'Critical',
      workforceProtectionBand: 'Very Weak',
      weaponReadinessBand: 'Poorly Armed',
      cartelPresence: null,
    });
    expect(['Promising', 'Highly Vulnerable']).toContain(outlook);
  });
});

describe('NW impact of worker transfer', () => {
  it('updates canonical NW by worker valuation', () => {
    const before = calculateCanonicalNetWorthFromPlayer({
      cash: 100_000,
      bankCash: 0,
      thugs: 100,
      prostitutes: 500,
      rides: 0,
      hash: 0,
      shrooms: 0,
      coke: 0,
      heroin: 0,
    });
    const after = calculateCanonicalNetWorthFromPlayer({
      cash: 100_000,
      bankCash: 0,
      thugs: 100,
      prostitutes: 518,
      rides: 0,
      hash: 0,
      shrooms: 0,
      coke: 0,
      heroin: 0,
    });
    expect(after - before).toBe(18 * CANONICAL_NET_WORTH_VALUATIONS.worker);
  });
});

describe('workforceProtectionBand', () => {
  it('rates strong protection when thugs match workers', () => {
    expect(workforceProtectionBand(800, 1000)).toBe('Strong');
    expect(workforceProtectionBand(100, 1000)).toBe('Weak');
  });
});

describe('workforceStabilityBand', () => {
  it('maps happiness tiers', () => {
    expect(workforceStabilityBand(85)).toBe('Very Stable');
    expect(workforceStabilityBand(10)).toBe('Critical');
  });
});
