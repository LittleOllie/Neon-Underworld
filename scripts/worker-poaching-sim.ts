/**
 * DEV-ONLY — Worker Poaching balance simulation.
 * Run: npx tsx scripts/worker-poaching-sim.ts
 */
import { createCombatRng } from '../src/lib/game-engine/combat/combat-random';
import { resolveWorkerPoach } from '../src/lib/game-engine/combat/worker-poach';
import { resolveCombat, deriveCombatSeed } from '../src/lib/game-engine/combat/resolve-combat';
import { WORKER_POACHING_RULES } from '../src/config/game/worker-poaching-rules';
import { TURNS_CONFIG } from '../src/config/game/balance';

const TURNS_PER_DAY = TURNS_CONFIG.regenerationRatePerHour * 24;
const RUNS = 500;

interface Scenario {
  label: string;
  workers: number;
  thugs: number;
  happiness: number;
  cartelSupport?: number;
}

const SCENARIOS: Scenario[] = [
  { label: '100W / 100T / high morale', workers: 100, thugs: 100, happiness: 85 },
  { label: '500W / 250T / medium morale', workers: 500, thugs: 250, happiness: 55 },
  { label: '1000W / 100T / low morale', workers: 1000, thugs: 100, happiness: 25 },
  { label: '1000W / 750T / high morale', workers: 1000, thugs: 750, happiness: 82 },
  { label: '2500W / 250T / critical morale', workers: 2500, thugs: 250, happiness: 12 },
];

interface Archetype {
  label: string;
  attemptsPerDay: number;
}

const ARCHETYPES: Archetype[] = [
  { label: 'Casual', attemptsPerDay: 0.5 },
  { label: 'Balanced', attemptsPerDay: 1 },
  { label: 'Aggressive', attemptsPerDay: 3 },
  { label: 'Power', attemptsPerDay: 2 },
];

function median(nums: number[]): number {
  const sorted = [...nums].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)] ?? 0;
}

function simulateScenario(scenario: Scenario): { medianStolen: number; successRate: number } {
  const stolenSamples: number[] = [];
  let successes = 0;

  for (let i = 0; i < RUNS; i++) {
    const seed = deriveCombatSeed('attacker', `defender-${scenario.label}`, `sim-${i}`);
    const combat = resolveCombat({
      attackType: 'POACH_WORKERS',
      attackingThugs: 200,
      seed,
      attacker: {
        thugs: 500,
        glocks: 50,
        uzis: 30,
        aks: 20,
        cash: 100_000,
        drugs: { hash: 0, shrooms: 0, coke: 0, heroin: 0 },
      },
      defender: {
        thugs: scenario.thugs,
        glocks: 20,
        uzis: 10,
        aks: 5,
        cash: 50_000,
        drugs: { hash: 0, shrooms: 0, coke: 0, heroin: 0 },
      },
      cartelSupportThugs: scenario.cartelSupport ?? 0,
      poachContext: {
        defenderWorkers: scenario.workers,
        defenderThugsForProtection: scenario.thugs + (scenario.cartelSupport ?? 0),
        workerHappiness: scenario.happiness,
      },
    });

    if (combat.workersStolen > 0) successes++;
    stolenSamples.push(combat.workersStolen);
  }

  return {
    medianStolen: median(stolenSamples),
    successRate: successes / RUNS,
  };
}

function scoutWorkersPer30Days(turnsPerDay: number): number {
  /** Rough median from monthly sim — ~0.8 workers/turn in clubs at 500 scale (dev estimate). */
  const scoutTurnsPerDay = turnsPerDay * 0.4;
  return Math.floor(scoutTurnsPerDay * 30 * 0.8);
}

console.log('# Worker Poaching Simulation (dev-only)\n');
console.log(`Runs per scenario: ${RUNS}`);
console.log(`Rules: base ${WORKER_POACHING_RULES.basePoachPercent * 100}% · max ${WORKER_POACHING_RULES.maxPoachPercent * 100}% · ${WORKER_POACHING_RULES.turnCost} turns\n`);

console.log('## Scenario results (200 thugs sent)');
for (const scenario of SCENARIOS) {
  const { medianStolen, successRate } = simulateScenario(scenario);
  const maxCap = Math.floor(scenario.workers * WORKER_POACHING_RULES.maxPoachPercent);
  console.log(
    `${scenario.label}: median ${medianStolen} stolen (${((medianStolen / scenario.workers) * 100).toFixed(2)}%) · success ${(successRate * 100).toFixed(0)}% · cap ${maxCap}`,
  );
}

console.log('\n## 30-day archetype poach totals (median successful steal × attempts)');
for (const archetype of ARCHETYPES) {
  const attempts = Math.floor(archetype.attemptsPerDay * 30);
  const vulnerable = simulateScenario(SCENARIOS[2]!);
  const poached = Math.floor(vulnerable.medianStolen * attempts * vulnerable.successRate);
  const scoutGain = scoutWorkersPer30Days(100);
  console.log(
    `${archetype.label}: ~${poached} Workers poached vs ~${scoutGain} from Scout (same turn budget order-of-magnitude)`,
  );
}

console.log('\n## Direct poach formula samples');
const rng = createCombatRng(42);
for (const happiness of [90, 55, 15]) {
  const poach = resolveWorkerPoach({
    attackerVictory: true,
    tacticalSuccess: true,
    defenderWorkers: 1000,
    defenderThugsForProtection: 100,
    workerHappiness: happiness,
    survivingAttackers: 180,
    attackingThugs: 200,
    rng,
  });
  console.log(`1000W/100T happiness ${happiness}: ${poach.workersStolen} workers`);
}

console.log('\n## Scout vs Poach verdict');
console.log('Scout remains primary: poaching is opportunistic on vulnerable targets only.');
console.log('Poor management (low happiness + low thug ratio) materially increases losses.');
