#!/usr/bin/env npx tsx
/**
 * Validate NPC dynamic progression over 7 / 30 simulated days (no DB).
 *
 *   npm run npc:progression-sim
 *   npm run npc:progression-sim -- --days=30
 */
import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';
import {
  NPC_LADDER_TOTAL_SLOTS,
  NPC_PROGRESSION_TICK_HOURS,
  archetypeForLadderSlot,
} from '../src/config/game/npc-progression-rules';
import {
  buildNpcTargetState,
  canonicalNwForTargetState,
} from '../src/lib/game-engine/npc-progression/target-state';
import { applyNpcProgressionTicks } from '../src/lib/game-engine/npc-progression/tick';
import { reconcileBusinessesTowardTarget } from '../src/lib/game-engine/npc-progression/reconcile';

const OUT = join(process.cwd(), 'scripts/output/npc-progression-sim.json');
const TICKS_PER_DAY = 24 / NPC_PROGRESSION_TICK_HOURS;

function parseArgs() {
  const daysArg = process.argv.find((a) => a.startsWith('--days='));
  const days = daysArg ? parseInt(daysArg.split('=')[1]!, 10) : 30;
  return { days: Math.max(1, days) };
}

function stats(values: number[]) {
  const s = [...values].sort((a, b) => a - b);
  const q = (p: number) => s[Math.min(s.length - 1, Math.floor(p * (s.length - 1)))] ?? 0;
  return {
    count: s.length,
    min: s[0] ?? 0,
    p10: q(0.1),
    p25: q(0.25),
    median: q(0.5),
    p75: q(0.75),
    p90: q(0.9),
    max: s[s.length - 1] ?? 0,
  };
}

function loadHumanSim(days: 7 | 30) {
  const path = join(process.cwd(), `scripts/output/round-sim-${days}d-100r.json`);
  const raw = JSON.parse(readFileSync(path, 'utf8')) as {
    finalDay: { activityProfiles: Array<{ activity: string; nwMedian: number }> };
  };
  const profiles = raw.finalDay.activityProfiles;
  return {
    CASUAL: profiles.find((p) => p.activity === 'CASUAL')?.nwMedian ?? 0,
    REGULAR: profiles.find((p) => p.activity === 'REGULAR')?.nwMedian ?? 0,
    ACTIVE: profiles.find((p) => p.activity === 'ACTIVE')?.nwMedian ?? 0,
    POWER: profiles.find((p) => p.activity === 'POWER')?.nwMedian ?? 0,
  };
}

function simulateNpcPopulation(maxDay: number) {
  const checkpoints = [1, 3, 7, 15, 21, 30].filter((d) => d <= maxDay);
  const history: Record<number, { nw: ReturnType<typeof stats>; samples: number[] }> = {};

  const slots = Array.from({ length: NPC_LADDER_TOTAL_SLOTS }, (_, slot) => {
    const growthSeed = slot * 7919 + 42;
    const archetype = archetypeForLadderSlot(slot, NPC_LADDER_TOTAL_SLOTS);
    let state = buildNpcTargetState({
      archetype,
      roundDay: 1,
      ladderSlot: slot,
      growthSeed,
      totalSlots: NPC_LADDER_TOTAL_SLOTS,
    });
    return { slot, growthSeed, archetype, state };
  });

  for (let day = 1; day <= maxDay; day++) {
    for (const npc of slots) {
      npc.state = applyNpcProgressionTicks(
        npc.state,
        {
          archetype: npc.archetype,
          roundDay: day,
          ladderSlot: npc.slot,
          growthSeed: npc.growthSeed,
          totalSlots: NPC_LADDER_TOTAL_SLOTS,
        },
        TICKS_PER_DAY,
        (day - 1) * TICKS_PER_DAY,
      );
      const target = buildNpcTargetState({
        archetype: npc.archetype,
        roundDay: day,
        ladderSlot: npc.slot,
        growthSeed: npc.growthSeed,
        totalSlots: NPC_LADDER_TOTAL_SLOTS,
      });
      npc.state = {
        ...npc.state,
        businesses: reconcileBusinessesTowardTarget(
          npc.state.businesses,
          target.businesses,
          0.2,
        ),
      };
    }
    if (checkpoints.includes(day)) {
      const nwValues = slots.map((n) => canonicalNwForTargetState(n.state));
      history[day] = { nw: stats(nwValues), samples: nwValues };
    }
  }

  return { slots, history };
}

function declineRate(samples: number[]): number {
  let declines = 0;
  for (let i = 1; i < samples.length; i++) {
    if (samples[i]! < samples[i - 1]!) declines++;
  }
  return samples.length <= 1 ? 0 : declines / (samples.length - 1);
}

const { days } = parseArgs();
const sim = simulateNpcPopulation(days);
const human7 = loadHumanSim(7);
const human30 = loadHumanSim(30);

const d7 = sim.history[7] ?? sim.history[days];
const d30 = sim.history[30] ?? sim.history[days];

const slotNwSeries = sim.slots.map((npc) => {
  let state = buildNpcTargetState({
    archetype: npc.archetype,
    roundDay: 1,
    ladderSlot: npc.slot,
    growthSeed: npc.growthSeed,
    totalSlots: NPC_LADDER_TOTAL_SLOTS,
  });
  const series: number[] = [canonicalNwForTargetState(state)];
  for (let day = 1; day <= Math.min(days, 7); day++) {
    state = applyNpcProgressionTicks(
      state,
      {
        archetype: npc.archetype,
        roundDay: day,
        ladderSlot: npc.slot,
        growthSeed: npc.growthSeed,
        totalSlots: NPC_LADDER_TOTAL_SLOTS,
      },
      TICKS_PER_DAY,
      (day - 1) * TICKS_PER_DAY,
    );
    series.push(canonicalNwForTargetState(state));
  }
  return series;
});

const report = {
  generatedAt: new Date().toISOString(),
  simulatedDays: days,
  ticksPerDay: TICKS_PER_DAY,
  tickHours: NPC_PROGRESSION_TICK_HOURS,
  checkpoints: sim.history,
  day7: d7
    ? {
        npc: d7.nw,
        human: human7,
        npcVsHuman: {
          medianVsCasual: d7.nw.median / human7.CASUAL,
          medianVsRegular: d7.nw.median / human7.REGULAR,
          medianVsActive: d7.nw.median / human7.ACTIVE,
          medianVsPower: d7.nw.median / human7.POWER,
          p90VsPower: d7.nw.p90 / human7.POWER,
        },
      }
    : null,
  day30: d30
    ? {
        npc: d30.nw,
        human: human30,
        npcVsHuman: {
          medianVsCasual: d30.nw.median / human30.CASUAL,
          medianVsRegular: d30.nw.median / human30.REGULAR,
          medianVsActive: d30.nw.median / human30.ACTIVE,
          medianVsPower: d30.nw.median / human30.POWER,
          p90VsPower: d30.nw.p90 / human30.POWER,
        },
      }
    : null,
  volatility: {
    avgDeclineRateDay1to7: stats(slotNwSeries.map(declineRate)).median,
    sampleSlotSeries: slotNwSeries.slice(0, 5),
  },
};

mkdirSync(join(process.cwd(), 'scripts/output'), { recursive: true });
writeFileSync(OUT, JSON.stringify(report, null, 2));

console.log(`NPC progression sim (${days}d) → ${OUT}`);
if (report.day7) {
  console.log(
    `D7 NPC median $${Math.round(report.day7.npc.median).toLocaleString()} vs human REGULAR $${Math.round(report.day7.human.REGULAR).toLocaleString()}`,
  );
}
if (report.day30) {
  console.log(
    `D30 NPC median $${Math.round(report.day30.npc.median).toLocaleString()} vs human REGULAR $${Math.round(report.day30.human.REGULAR).toLocaleString()}`,
  );
}
