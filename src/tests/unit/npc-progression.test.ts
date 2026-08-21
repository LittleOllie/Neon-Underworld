import { describe, expect, it } from 'vitest';
import {
  isProgressionNpcAccount,
  isProgressionNpcEmail,
  isLocalNpcProgressionEnabled,
} from '@/lib/game-engine/npc-progression/identification';
import {
  interpolateNpcLadderBand,
  archetypeForLadderSlot,
  NPC_ARCHETYPE_PROFILES,
} from '@/config/game/npc-progression-rules';
import {
  buildNpcTargetState,
  computeNpcTargetNw,
  canonicalNwForTargetState,
} from '@/lib/game-engine/npc-progression/target-state';
import {
  reconcileScalar,
  reconcileTowardTarget,
  compoundRecoveryRate,
} from '@/lib/game-engine/npc-progression/reconcile';
import {
  applyNpcProgressionTicks,
  applySingleNpcProgressionTick,
  computeDueTickCount,
} from '@/lib/game-engine/npc-progression/tick';
import {
  NPC_PROGRESSION_MAX_CATCHUP_HOURS,
  NPC_PROGRESSION_TICK_HOURS,
} from '@/config/game/npc-progression-rules';
import { getSeasonRoundDay } from '@/lib/game-engine/npc-progression/round-age';
import { progressionMetaForDevPvp } from '@/lib/game-engine/npc-progression/initialize';
import { minAttackTargetNetWorth } from '@/config/game/redlite-rules';

describe('NPC identification', () => {
  it('identifies progression NPC emails', () => {
    expect(isProgressionNpcEmail('playtest-npc+neonrunner01@neonunderworld.local')).toBe(true);
    expect(isProgressionNpcEmail('dev-pvp+neonviper@neonunderworld.local')).toBe(true);
    expect(isProgressionNpcEmail('system+vex@neonunderworld.local')).toBe(false);
    expect(isProgressionNpcEmail('player@example.com')).toBe(false);
  });

  it('never selects system filler or humans for progression', () => {
    expect(
      isProgressionNpcAccount({
        isSystemPlayer: true,
        email: 'system+vex@neonunderworld.local',
      }),
    ).toBe(false);
    expect(
      isProgressionNpcAccount({
        isSystemPlayer: false,
        email: 'playtest-npc+test@neonunderworld.local',
      }),
    ).toBe(true);
    expect(
      isProgressionNpcAccount({
        isSystemPlayer: false,
        email: 'simon@example.com',
      }),
    ).toBe(false);
  });

  it('excludes local-npc fixtures unless NPC_PROGRESSION_INCLUDE_LOCAL=true', () => {
    const prev = process.env.NPC_PROGRESSION_INCLUDE_LOCAL;
    process.env.NPC_PROGRESSION_INCLUDE_LOCAL = 'false';
    expect(isProgressionNpcEmail('local-npc+fixture01@neonunderworld.local')).toBe(false);
    process.env.NPC_PROGRESSION_INCLUDE_LOCAL = 'true';
    expect(isProgressionNpcEmail('local-npc+fixture01@neonunderworld.local')).toBe(true);
    process.env.NPC_PROGRESSION_INCLUDE_LOCAL = prev;
    expect(typeof isLocalNpcProgressionEnabled()).toBe('boolean');
  });
});

describe('NW ladder bands', () => {
  it('interpolates round-age checkpoints', () => {
    expect(interpolateNpcLadderBand(1).minNw).toBe(10_000);
    expect(interpolateNpcLadderBand(1).maxNw).toBe(240_000);
    const d7 = interpolateNpcLadderBand(7);
    expect(d7.minNw).toBe(100_000);
    expect(d7.maxNw).toBe(8_000_000);
    const d30 = interpolateNpcLadderBand(30);
    expect(d30.maxNw).toBe(100_000_000);
  });

  it('spreads target NW across ladder slots', () => {
    const low = computeNpcTargetNw(15, 0, 42, 50);
    const high = computeNpcTargetNw(15, 49, 42, 50);
    expect(high).toBeGreaterThan(low * 5);
  });
});

describe('archetype profiles', () => {
  it('assigns distinct archetypes across ladder', () => {
    expect(archetypeForLadderSlot(0, 50)).toBe('STREET_HUSTLER');
    expect(archetypeForLadderSlot(49, 50)).toBe('SYNDICATE_BOSS');
  });

  it('builds militarily credible enforcer targets', () => {
    const target = buildNpcTargetState({
      archetype: 'ENFORCER',
      roundDay: 15,
      ladderSlot: 15,
      growthSeed: 12345,
      totalSlots: 50,
    });
    expect(target.thugs).toBeGreaterThan(target.prostitutes);
    expect(target.glocks + target.uzis + target.aks).toBeGreaterThan(0);
    expect(target.rides).toBeGreaterThanOrEqual(Math.ceil(target.thugs / 5));
  });

  it('gives kingpin businesses at high round day', () => {
    const target = buildNpcTargetState({
      archetype: 'KINGPIN',
      roundDay: 21,
      ladderSlot: 35,
      growthSeed: 999,
      totalSlots: 50,
    });
    expect(target.businesses.length).toBeGreaterThan(0);
    const nw = canonicalNwForTargetState(target);
    expect(nw).toBeGreaterThan(1_000_000);
  });
});

describe('recovery model', () => {
  it('never shrinks resources during reconciliation', () => {
    expect(reconcileScalar(1000, 500, 0.5)).toBe(1000);
    expect(reconcileScalar(50, 200, 0.12)).toBe(Math.floor(50 + 150 * 0.12));
  });

  it('does not instantly restore after simulated attack losses', () => {
    const target = buildNpcTargetState({
      archetype: 'OPERATOR',
      roundDay: 15,
      ladderSlot: 25,
      growthSeed: 555,
      totalSlots: 50,
    });
    const damaged = {
      ...target,
      thugs: Math.floor(target.thugs * 0.4),
      cash: Math.floor(target.cash * 0.3),
      prostitutes: Math.floor(target.prostitutes * 0.5),
    };
    const once = reconcileTowardTarget(damaged, target, 0.12);
    expect(once.thugs).toBeLessThan(target.thugs);
    expect(once.cash).toBeLessThan(target.cash);
    expect(once.prostitutes).toBeLessThan(target.prostitutes);
  });

  it('compounds recovery over multiple days', () => {
    expect(compoundRecoveryRate(1)).toBeCloseTo(0.12, 5);
    expect(compoundRecoveryRate(7)).toBeGreaterThan(0.5);
    expect(compoundRecoveryRate(7)).toBeLessThan(1);
  });
});

describe('round age', () => {
  it('derives season day from dates', () => {
    const start = new Date('2026-01-01T00:00:00Z');
    const end = new Date('2026-01-31T00:00:00Z');
    expect(getSeasonRoundDay(start, end, new Date('2026-01-01T12:00:00Z'))).toBe(1);
    expect(getSeasonRoundDay(start, end, new Date('2026-01-08T00:00:00Z'))).toBe(8);
  });
});

describe('dev-pvp progression metadata', () => {
  it('assigns deterministic slots per alias without changing stats path', () => {
    const rust = progressionMetaForDevPvp(0, 'RustRunner');
    const auditor = progressionMetaForDevPvp(9, 'NightAuditor');
    expect(rust.ladderSlot).toBe(2);
    expect(auditor.ladderSlot).toBe(47);
    expect(rust.growthSeed).toBe(progressionMetaForDevPvp(0, 'rustrunner').growthSeed);
  });
});

describe('attack eligibility coverage', () => {
  it('provides multiple NPC targets at representative human NW', () => {
    const humanNw = 2_000_000;
    const minTarget = minAttackTargetNetWorth(humanNw);
    const npcNws = Array.from({ length: 50 }, (_, slot) =>
      canonicalNwForTargetState(
        buildNpcTargetState({
          archetype: archetypeForLadderSlot(slot, 50),
          roundDay: 15,
          ladderSlot: slot,
          growthSeed: slot * 7919 + 42,
          totalSlots: 50,
        }),
      ),
    );
    const eligible = npcNws.filter((nw) => nw >= minTarget);
    expect(eligible.length).toBeGreaterThan(5);
  });
});

describe('fresh scout baseline unchanged', () => {
  it('street hustler day-1 target remains modest', () => {
    const target = buildNpcTargetState({
      archetype: 'STREET_HUSTLER',
      roundDay: 1,
      ladderSlot: 2,
      growthSeed: 100,
      totalSlots: 50,
    });
    const nw = canonicalNwForTargetState(target);
    expect(nw).toBeGreaterThan(20_000);
    expect(nw).toBeLessThan(200_000);
    expect(NPC_ARCHETYPE_PROFILES.STREET_HUSTLER.businessTier).toBe(0);
  });
});

describe('dynamic tick progression', () => {
  it('computes due ticks from elapsed hours with catch-up cap', () => {
    const last = new Date('2026-01-01T00:00:00Z');
    const now18h = new Date(last.getTime() + 18 * 3_600_000);
    expect(computeDueTickCount({ lastProgressedAt: last, now: now18h })).toBe(3);
    const now72h = new Date(last.getTime() + 72 * 3_600_000);
    expect(computeDueTickCount({ lastProgressedAt: last, now: now72h })).toBe(
      Math.floor(NPC_PROGRESSION_MAX_CATCHUP_HOURS / NPC_PROGRESSION_TICK_HOURS),
    );
    expect(computeDueTickCount({ lastProgressedAt: last, now: now72h, force: true })).toBe(1);
  });

  it('allows NPC net worth to grow over multiple ticks', () => {
    const base = buildNpcTargetState({
      archetype: 'OPERATOR',
      roundDay: 5,
      ladderSlot: 20,
      growthSeed: 777,
      totalSlots: 50,
    });
    const after = applyNpcProgressionTicks(
      base,
      { archetype: 'OPERATOR', roundDay: 5, ladderSlot: 20, growthSeed: 777, totalSlots: 50 },
      8,
    );
    expect(canonicalNwForTargetState(after)).toBeGreaterThanOrEqual(canonicalNwForTargetState(base) * 0.85);
  });

  it('allows NPC net worth to decline during setback ticks', () => {
    let state = buildNpcTargetState({
      archetype: 'STREET_HUSTLER',
      roundDay: 10,
      ladderSlot: 5,
      growthSeed: 42,
      totalSlots: 50,
    });
    let sawDecline = false;
    for (let i = 0; i < 40; i++) {
      const before = canonicalNwForTargetState(state);
      state = applySingleNpcProgressionTick({
        state,
        archetype: 'STREET_HUSTLER',
        roundDay: 10,
        ladderSlot: 5,
        growthSeed: 42,
        totalSlots: 50,
        tickIndex: i,
      });
      if (canonicalNwForTargetState(state) < before) sawDecline = true;
    }
    expect(sawDecline).toBe(true);
  });

  it('preserves attacked state as progression baseline (no snap to target)', () => {
    const target = buildNpcTargetState({
      archetype: 'OPERATOR',
      roundDay: 15,
      ladderSlot: 25,
      growthSeed: 555,
      totalSlots: 50,
    });
    const damaged = {
      ...target,
      thugs: Math.floor(target.thugs * 0.35),
      cash: Math.floor(target.cash * 0.25),
      prostitutes: Math.floor(target.prostitutes * 0.45),
    };
    const afterOne = applySingleNpcProgressionTick({
      state: damaged,
      archetype: 'OPERATOR',
      roundDay: 15,
      ladderSlot: 25,
      growthSeed: 555,
      totalSlots: 50,
      tickIndex: 0,
    });
    expect(afterOne.thugs).toBeLessThan(target.thugs);
    expect(afterOne.cash).toBeLessThan(target.cash);
  });

  it('diverges archetypes over time', () => {
    const ctx = { roundDay: 14, totalSlots: 50 as const };
    const hustler = applyNpcProgressionTicks(
      buildNpcTargetState({ archetype: 'STREET_HUSTLER', ladderSlot: 2, growthSeed: 100, ...ctx }),
      { archetype: 'STREET_HUSTLER', ladderSlot: 2, growthSeed: 100, ...ctx },
      16,
    );
    const enforcer = applyNpcProgressionTicks(
      buildNpcTargetState({ archetype: 'ENFORCER', ladderSlot: 15, growthSeed: 200, ...ctx }),
      { archetype: 'ENFORCER', ladderSlot: 15, growthSeed: 200, ...ctx },
      16,
    );
    expect(enforcer.thugs / Math.max(1, enforcer.prostitutes)).toBeGreaterThan(
      hustler.thugs / Math.max(1, hustler.prostitutes),
    );
  });

  it('large NPC does not explode from a single tick batch', () => {
    const big = buildNpcTargetState({
      archetype: 'SYNDICATE_BOSS',
      roundDay: 25,
      ladderSlot: 48,
      growthSeed: 999,
      totalSlots: 50,
    });
    const nwBefore = canonicalNwForTargetState(big);
    const after = applyNpcProgressionTicks(
      big,
      {
        archetype: 'SYNDICATE_BOSS',
        roundDay: 25,
        ladderSlot: 48,
        growthSeed: 999,
        totalSlots: 50,
      },
      8,
    );
    const nwAfter = canonicalNwForTargetState(after);
    expect(nwAfter).toBeLessThan(nwBefore * 1.35);
    expect(nwAfter).toBeGreaterThan(nwBefore * 0.65);
  });
});
