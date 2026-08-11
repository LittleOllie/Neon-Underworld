/**
 * Scout economy Monte Carlo — run: npx tsx scripts/scout-economy-sim.ts
 */
import { resolveScouting } from '../src/lib/game-engine/scouting';
import { DISTRICTS } from '../src/config/game/balance';
import { happinessEfficiencyModifier } from '../src/lib/game-engine/happiness';
import { grossWorkerCash, playerCashFromGross } from '../src/lib/game-engine/worker-economics';

const neonModifiers = DISTRICTS.find((d) => d.slug === 'neon-strip')!.modifiers;
const TURN_SPENDS = [10, 25, 50, 100, 250, 500, 1000, 2500, 5000];
const AREAS = ['streets', 'clubs', 'docks', 'alleys', 'markets'] as const;
const SAMPLES = 5000;

function simulate(
  turns: number,
  area: string,
  prostitutes: number,
  happiness: number,
  payout = 50,
  seedBase = 0,
) {
  let workers = 0;
  let thugs = 0;
  let zeroTotal = 0;
  let retained = 0;

  for (let i = 0; i < SAMPLES; i++) {
    const r = resolveScouting({
      turnsSpent: turns,
      districtModifiers: neonModifiers,
      areaSlug: area,
      prostituteHappiness: happiness,
      thugHappiness: happiness,
      prostituteCount: prostitutes,
      thugCount: 40,
      prostitutePayoutPercent: payout,
      seed: seedBase + i,
    });
    workers += r.prostitutesFound;
    thugs += r.thugsFound;
    if (r.prostitutesFound + r.thugsFound === 0) zeroTotal++;
    retained += r.cashEarned;
  }

  const gross = grossWorkerCash(prostitutes, turns);
  const eff = happinessEfficiencyModifier(happiness);
  const expectedRetained = Math.floor(playerCashFromGross(gross, payout) * eff);

  return {
    avgWorkers: workers / SAMPLES,
    avgThugs: thugs / SAMPLES,
    avgTotal: (workers + thugs) / SAMPLES,
    zeroTotalPct: (zeroTotal / SAMPLES) * 100,
    avgRetained: retained / SAMPLES,
    expectedRetained,
  };
}

console.log('=== Scout economy simulation (Neon Strip, 300 workers, 80% morale) ===\n');
console.log('Turns | Workers | Thugs | Total | Zero% | Avg retained $');
for (const turns of TURN_SPENDS) {
  const r = simulate(turns, 'streets', 300, 80);
  console.log(
    `${String(turns).padStart(5)} | ${r.avgWorkers.toFixed(2).padStart(7)} | ${r.avgThugs.toFixed(2).padStart(5)} | ${r.avgTotal.toFixed(2).padStart(5)} | ${r.zeroTotalPct.toFixed(2).padStart(5)}% | ${Math.round(r.avgRetained).toLocaleString()}`,
  );
}

console.log('\n=== 100 turns by area (300 workers, 80% morale) ===');
for (const area of AREAS) {
  const r = simulate(100, area, 300, 80, 50, area.charCodeAt(0) * 1000);
  console.log(`${area.padEnd(10)} workers ${r.avgWorkers.toFixed(2)} thugs ${r.avgThugs.toFixed(2)} total ${r.avgTotal.toFixed(2)}`);
}

console.log('\n=== Split invariance (1000 turns, streets, 100 workers) ===');
function splitAvg(parts: number[], seedBase: number) {
  let w = 0;
  let t = 0;
  for (let s = 0; s < 500; s++) {
    let workers = 0;
    let thugs = 0;
    parts.forEach((turns, idx) => {
      const r = resolveScouting({
        turnsSpent: turns,
        districtModifiers: neonModifiers,
        areaSlug: 'streets',
        prostituteHappiness: 80,
        thugHappiness: 80,
        prostituteCount: 100,
        thugCount: 40,
        prostitutePayoutPercent: 50,
        seed: seedBase + s * 20 + idx,
      });
      workers += r.prostitutesFound;
      thugs += r.thugsFound;
    });
    w += workers;
    t += thugs;
  }
  return { workers: w / 500, thugs: t / 500, total: (w + t) / 500 };
}

const splits = [
  { label: '1×1000', parts: [1000] },
  { label: '2×500', parts: [500, 500] },
  { label: '4×250', parts: [250, 250, 250, 250] },
  { label: '10×100', parts: Array(10).fill(100) },
  { label: '20×50', parts: Array(20).fill(50) },
];
for (const s of splits) {
  const r = splitAvg(s.parts, 90_000);
  console.log(`${s.label.padEnd(8)} total recruits ${r.total.toFixed(2)}`);
}
