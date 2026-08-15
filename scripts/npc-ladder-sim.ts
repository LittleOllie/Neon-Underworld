#!/usr/bin/env npx tsx
/** 30-day NPC ladder simulation — read-only, no DB required. */
import { writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';
import {
  NPC_ARCHETYPE_IDS,
  NPC_LADDER_TOTAL_SLOTS,
  archetypeForLadderSlot,
} from '../src/config/game/npc-progression-rules';
import {
  buildNpcTargetState,
  canonicalNwForTargetState,
  computeNpcTargetNw,
} from '../src/lib/game-engine/npc-progression/target-state';
import { minAttackTargetNetWorth } from '../src/config/game/redlite-rules';

const OUT = join(process.cwd(), 'scripts/output/npc-ladder-sim.json');
const CHECKPOINTS = [1, 3, 7, 15, 21, 30] as const;
const DISTRICTS = ['neon-strip', 'docklands', 'old-quarter'] as const;
const HUMAN_NW_LEVELS = [100_000, 250_000, 500_000, 1_000_000, 2_500_000, 5_000_000, 10_000_000, 20_000_000, 50_000_000, 100_000_000];

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

function simulateDay(roundDay: number) {
  const npcs = [];
  for (let slot = 0; slot < NPC_LADDER_TOTAL_SLOTS; slot++) {
    const growthSeed = slot * 7919 + 42;
    const archetype = archetypeForLadderSlot(slot, NPC_LADDER_TOTAL_SLOTS);
    const target = buildNpcTargetState({
      archetype,
      roundDay,
      ladderSlot: slot,
      growthSeed,
      totalSlots: NPC_LADDER_TOTAL_SLOTS,
    });
    const nw = canonicalNwForTargetState(target);
    npcs.push({
      slot,
      archetype,
      district: DISTRICTS[slot % DISTRICTS.length]!,
      nw,
      workers: target.prostitutes + target.businesses.reduce((s, b) => s + b.assignedWorkers, 0),
      thugs: target.thugs + target.businesses.reduce((s, b) => s + b.assignedThugs, 0),
      businesses: target.businesses.length,
      targetNw: computeNpcTargetNw(roundDay, slot, growthSeed, NPC_LADDER_TOTAL_SLOTS),
    });
  }
  return npcs;
}

function bucketTargets(npcs: { nw: number; district: string }[], humanNw: number) {
  const minTarget = minAttackTargetNetWorth(humanNw);
  const eligible = npcs.filter((n) => n.nw >= minTarget);
  const buckets = {
    '>=0.5x': 0,
    '0.5-0.75x': 0,
    '0.75-1.0x': 0,
    '1.0-1.25x': 0,
    '1.25-1.5x': 0,
    '1.5-2.0x': 0,
    '>=2.0x': 0,
  };
  for (const n of eligible) {
    const ratio = humanNw > 0 ? n.nw / humanNw : 0;
    if (ratio >= 2) buckets['>=2.0x']++;
    else if (ratio >= 1.5) buckets['1.5-2.0x']++;
    else if (ratio >= 1.25) buckets['1.25-1.5x']++;
    else if (ratio >= 1.0) buckets['1.0-1.25x']++;
    else if (ratio >= 0.75) buckets['0.75-1.0x']++;
    else if (ratio >= 0.5) buckets['0.5-0.75x']++;
  }
  buckets['>=0.5x'] = eligible.length;
  return { minTarget, eligible: eligible.length, buckets };
}

const checkpointReports: Record<string, object> = {};
for (const day of CHECKPOINTS) {
  const npcs = simulateDay(day);
  const nwValues = npcs.map((n) => n.nw);
  const byArchetype = Object.fromEntries(
    NPC_ARCHETYPE_IDS.map((id) => [id, npcs.filter((n) => n.archetype === id).length]),
  );
  const byDistrict = Object.fromEntries(
    DISTRICTS.map((d) => [d, npcs.filter((n) => n.district === d).length]),
  );
  checkpointReports[day] = {
    day,
    nw: stats(nwValues),
    byArchetype,
    byDistrict,
    medianWorkers: stats(npcs.map((n) => n.workers)).median,
    medianThugs: stats(npcs.map((n) => n.thugs)).median,
    maxWorkers: Math.max(...npcs.map((n) => n.workers)),
    maxThugs: Math.max(...npcs.map((n) => n.thugs)),
  };
}

const humanTargetTable: Record<string, object> = {};
for (const humanNw of HUMAN_NW_LEVELS) {
  const day30 = simulateDay(30);
  humanTargetTable[String(humanNw)] = bucketTargets(day30, humanNw);
}

mkdirSync(join(process.cwd(), 'scripts/output'), { recursive: true });
writeFileSync(
  OUT,
  JSON.stringify({ generatedAt: new Date().toISOString(), checkpointReports, humanTargetTable }, null, 2),
);

console.log('NPC Ladder Simulation (Day 30):');
const d30 = checkpointReports[30] as { nw: { min: number; median: number; max: number } };
console.log(`  NW range: $${(d30.nw.min / 1e6).toFixed(2)}M — $${(d30.nw.max / 1e6).toFixed(1)}M (median $${(d30.nw.median / 1e6).toFixed(1)}M)`);
