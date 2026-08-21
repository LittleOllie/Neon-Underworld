import { describe, expect, it } from 'vitest';
import {
  buildAttackCoverageReports,
  type PlaytestNpcSnapshot,
} from '@/lib/game-engine/playtest-npc-round-init';
import { buildNpcTargetState, canonicalNwForTargetState } from '@/lib/game-engine/npc-progression/target-state';
import { archetypeForLadderSlot } from '@/config/game/npc-progression-rules';
import { minAttackTargetNetWorth, maxAttackTargetNetWorth } from '@/config/game/redlite-rules';

function snapshot(slot: number, districtSlug: string): PlaytestNpcSnapshot {
  const growthSeed = slot * 7919 + 42;
  const archetype = archetypeForLadderSlot(slot, 50);
  const target = buildNpcTargetState({
    archetype,
    roundDay: 1,
    ladderSlot: slot,
    growthSeed,
    totalSlots: 50,
  });
  return {
    playerId: `p-${slot}`,
    alias: `Npc${String(slot + 1).padStart(2, '0')}`,
    districtSlug,
    ladderSlot: slot,
    archetype,
    netWorth: canonicalNwForTargetState(target),
  };
}

describe('playtest NPC round init coverage', () => {
  it('builds day-1 ladder spread across districts', () => {
    const districts = ['neon-strip', 'docklands', 'old-quarter'] as const;
    const snapshots = Array.from({ length: 50 }, (_, slot) =>
      snapshot(slot, districts[slot % districts.length]!),
    );
    const nw = snapshots.map((s) => s.netWorth).sort((a, b) => a - b);
    expect(nw[0]).toBeGreaterThanOrEqual(9_000);
    expect(nw[nw.length - 1]).toBeLessThan(1_500_000);
    expect(nw[Math.floor(nw.length / 2)]).toBeGreaterThan(60_000);
  });

  it('gives early-round players multiple targets inside 60%–170%', () => {
    const snapshots = Array.from({ length: 50 }, (_, slot) =>
      snapshot(slot, ['neon-strip', 'docklands', 'old-quarter'][slot % 3]!),
    );
    const hermanNw = 44_941;
    const [report] = buildAttackCoverageReports(snapshots, [hermanNw]);
    expect(report.minTarget).toBe(minAttackTargetNetWorth(hermanNw));
    expect(report.maxTarget).toBe(maxAttackTargetNetWorth(hermanNw));
    expect(report.totalEligible).toBeGreaterThanOrEqual(3);
    expect(report.totalEligible).toBeLessThan(20);
  });
});
