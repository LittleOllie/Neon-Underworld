import { describe, expect, it } from 'vitest';
import {
  isProgressionNpcAccount,
  isProgressionNpcEmail,
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
});

describe('NW ladder bands', () => {
  it('interpolates round-age checkpoints', () => {
    expect(interpolateNpcLadderBand(1).minNw).toBe(50_000);
    expect(interpolateNpcLadderBand(1).maxNw).toBe(2_000_000);
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
    expect(nw).toBeGreaterThan(40_000);
    expect(nw).toBeLessThan(500_000);
    expect(NPC_ARCHETYPE_PROFILES.STREET_HUSTLER.businessTier).toBe(0);
  });
});
