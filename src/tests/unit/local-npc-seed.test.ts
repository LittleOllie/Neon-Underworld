import { describe, expect, it } from 'vitest';
import {
  LOCAL_NPC_COUNT,
  LOCAL_NPC_EDGE_PATCHES,
  LOCAL_NPC_NW_BAND,
  localNpcAlias,
  localNpcEmail,
  progressionMetaForLocalSlot,
  roundDayForLocalSlot,
} from '../../../scripts/lib/local-npc-seed';
import { buildNpcTargetState, canonicalNwForTargetState } from '@/lib/game-engine/npc-progression/target-state';
import { minAttackTargetNetWorth } from '@/config/game/redlite-rules';

describe('local-npc-seed fixtures', () => {
  it('generates 40 unique fixture aliases and emails', () => {
    const aliases = new Set(Array.from({ length: LOCAL_NPC_COUNT }, (_, i) => localNpcAlias(i)));
    expect(aliases.size).toBe(LOCAL_NPC_COUNT);
    expect(localNpcAlias(0)).toMatch(/^Fix/);
    expect(localNpcEmail('fixneonrunner01')).toBe(
      'local-npc+fixneonrunner01@neonunderworld.local',
    );
  });

  it('uses a local NW band suited to fresh human accounts', () => {
    const states = Array.from({ length: LOCAL_NPC_COUNT }, (_, i) => {
      const meta = progressionMetaForLocalSlot(i);
      return buildNpcTargetState({
        archetype: meta.archetype,
        roundDay: roundDayForLocalSlot(meta.ladderSlot),
        ladderSlot: meta.ladderSlot,
        growthSeed: meta.growthSeed,
        totalSlots: LOCAL_NPC_COUNT,
        nwBand: LOCAL_NPC_NW_BAND,
      });
    });

    const nwValues = states.map((s) => canonicalNwForTargetState(s));
    expect(Math.min(...nwValues)).toBeGreaterThanOrEqual(LOCAL_NPC_NW_BAND.minNw * 0.85);
    expect(Math.max(...nwValues)).toBeLessThanOrEqual(LOCAL_NPC_NW_BAND.maxNw * 1.15);

    const humanNw = 10_000;
    const floor = minAttackTargetNetWorth(humanNw);
    const attackable = nwValues.filter((nw) => nw >= floor);
    const belowRange = nwValues.filter((nw) => nw < floor);
    expect(attackable.length).toBeGreaterThan(20);
    expect(belowRange.length).toBeGreaterThan(0);
  });

  it('spreads archetypes across the ladder', () => {
    const archetypes = new Set(
      Array.from({ length: LOCAL_NPC_COUNT }, (_, i) => progressionMetaForLocalSlot(i).archetype),
    );
    expect(archetypes.size).toBeGreaterThanOrEqual(4);
  });

  it('defines attack edge-case patches without bypassing rules', () => {
    expect(LOCAL_NPC_EDGE_PATCHES[6]?.travelling).toBe(true);
    expect(LOCAL_NPC_EDGE_PATCHES[9]?.lastSeenHoursAgo).toBeGreaterThan(48);
  });
});
