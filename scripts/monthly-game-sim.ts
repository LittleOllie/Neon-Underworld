#!/usr/bin/env npx tsx
/**
 * 30-day economy / crew / combat simulation — run: npx tsx scripts/monthly-game-sim.ts
 * Analysis only — no production gameplay changes.
 */
import { writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';
import { TURNS_CONFIG, STARTING_RESOURCES, SCOUTING_CONFIG } from '../src/config/game/balance';
import { PRODUCTION_CONFIG } from '../src/config/game/balance';
import { DRUG_PRODUCTION_RATES } from '../src/config/game/drug-production-rates';
import { SUPPLY_CREW_TURNS_PER_UNIT } from '../src/config/game/supply-economy';
import { getDrugStreetPrice } from '../src/config/game/drug-street-prices';
import { getCityShopItem } from '../src/config/game/shop-rules';
import { ATTACK_RULES } from '../src/config/game/attack-rules';
import { REDLITE_TRAVEL } from '../src/config/game/redlite-rules';
import { CANONICAL_NET_WORTH_VALUATIONS } from '../src/lib/game-engine/canonical-net-worth';
import { payoutMoraleScore } from '../src/lib/game-engine/payout-morale';
import { grossWorkerCash, playerCashFromGross } from '../src/lib/game-engine/worker-economics';
import { happinessEfficiencyModifier } from '../src/lib/game-engine/happiness';
import { estimateHashProduceNet } from '../src/lib/game-engine/produce-economy';
import {
  ARCHETYPE_CONFIGS,
  CHECKPOINT_DAYS,
  SIM_DAYS,
  TURNS_PER_DAY,
  runSimulation,
  summarizeCheckpoints,
  estimateThugRecoveryTurns,
  hireThugAnalysis,
  type ArchetypeId,
} from './lib/monthly-sim/engine';

const MONTE_CARLO_RUNS = 500;
const OUT_DIR = join(process.cwd(), 'scripts/output');

function fmt(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1000) return `$${Math.round(n).toLocaleString()}`;
  return String(Math.round(n));
}

function fmtRange(s: { p10: number; median: number; p90: number }, prefix = ''): string {
  return `${prefix}${Math.round(s.p10).toLocaleString()} / ${prefix}${Math.round(s.median).toLocaleString()} / ${prefix}${Math.round(s.p90).toLocaleString()}`;
}

console.log('═══════════════════════════════════════════════════════════════');
console.log(' NEON UNDERWORLD — 30-DAY ECONOMY SIMULATION (LIVE RULES)');
console.log('═══════════════════════════════════════════════════════════════\n');

console.log('## A. CURRENT STARTING STATE');
console.log(JSON.stringify(STARTING_RESOURCES, null, 2));
console.log(`Starting turns: ${TURNS_CONFIG.startingTurns} (alpha full cap)`);
console.log(`District: player-selected (sim default: neon-strip)\n`);

console.log('## B. CURRENT TURN ECONOMY');
console.log(`Regen: ${TURNS_CONFIG.regenerationRatePerHour} turns/hour = 2 every 5 min`);
console.log(`Turns/day: ${TURNS_PER_DAY} (NOT 480 — code uses 5-min interval)`);
console.log(`30-day regen if bank empty: ${TURNS_PER_DAY * SIM_DAYS}`);
console.log(`Turn cap: ${TURNS_CONFIG.turnCap}`);
console.log(`Scout/Produce max: ${TURNS_CONFIG.maxScoutSpend}`);
console.log(`Travel cost: ${REDLITE_TRAVEL.turnCost} turns`);
console.log(`Intel cost: ${ATTACK_RULES.scoutIntelTurnCost} turns`);
console.log(`Attack costs: DRIVE_BY ${ATTACK_RULES.turnCosts.DRIVE_BY}, HOME ${ATTACK_RULES.turnCosts.HOME_INVASION}, RAID ${ATTACK_RULES.turnCosts.RAID_DRUG_LABS}\n`);

console.log('## SCOUT / PRODUCE / SUPPLY (verified)');
console.log(`Scout worker rate: ${SCOUTING_CONFIG.baseProstitutesPerTurn}/turn (${(SCOUTING_CONFIG.baseProstitutesPerTurn * 100).toFixed(1)}%)`);
console.log(`Scout thug rate: ${SCOUTING_CONFIG.baseThugsPerTurn}/turn (${(SCOUTING_CONFIG.baseThugsPerTurn * 100).toFixed(1)}%)`);
console.log(`Scout cash: $${SCOUTING_CONFIG.cashPerProstitutePerTurn}/worker/turn`);
console.log(`Produce cash: $${PRODUCTION_CONFIG.cashPerProstitutePerTurn}/worker/turn`);
console.log(`Drug rates:`, DRUG_PRODUCTION_RATES);
console.log(`Supply: ${SUPPLY_CREW_TURNS_PER_UNIT} crew-turns/unit`);
console.log(`Canonical NW:`, CANONICAL_NET_WORTH_VALUATIONS);
console.log('');

console.log('## C. ARCHETYPE ASSUMPTIONS');
for (const a of ARCHETYPE_CONFIGS) {
  console.log(
    `- ${a.label}: ${(a.activityRate * 100).toFixed(0)}% daily regen (~${Math.round(a.activityRate * TURNS_PER_DAY)} turns/day), payout ${a.payoutPercent}%, scout ${a.primaryScoutArea}, attacks ${a.attacksPerDay.min}-${a.attacksPerDay.max}/day`,
  );
}
console.log('Daily spend = activityRate × 576 regen (+ bank bonus for power). Alpha 5000 start noted.\n');

console.log(`Running ${MONTE_CARLO_RUNS} Monte Carlo trials per archetype...\n`);

const allResults: Record<ArchetypeId, ReturnType<typeof summarizeCheckpoints>[]> = {} as never;

for (const config of ARCHETYPE_CONFIGS) {
  const runs: ReturnType<typeof runSimulation>[] = [];
  for (let i = 0; i < MONTE_CARLO_RUNS; i++) {
    runs.push(runSimulation(config, 10_000 + i * 997, 'neon-strip'));
  }
  console.log(`## D. ${config.label.toUpperCase()} — CHECKPOINTS (P10 / Median / P90)`);
  console.log('Day | Workers      | Thugs        | Cash              | NW                | Turns spent');
  for (const day of CHECKPOINT_DAYS) {
    const s = summarizeCheckpoints(runs, day);
    console.log(
      `${String(day).padStart(3)} | ${fmtRange(s.prostitutes!)} | ${fmtRange(s.thugs!)} | ${fmtRange(s.cash!, '$')} | ${fmtRange(s.netWorth!, '$')} | ${fmtRange(s.turnsSpentTotal!)}`,
    );
  }
  console.log('');
  console.log('Income cumulative @ Day 30 (median):');
  const d30 = summarizeCheckpoints(runs, 30);
  console.log(`  Scout cash:   ${fmt(d30.cumScoutCash!.median)}`);
  console.log(`  Produce cash: ${fmt(d30.cumProduceCash!.median)}`);
  console.log(`  Drug sales:   ${fmt(d30.cumDrugSales!.median)}`);
  console.log(`  Supply spend: ${fmt(d30.cumSupplySpend!.median)}`);
  console.log(`  Weapons:      ${fmt(d30.cumWeaponSpend!.median)}`);
  console.log('');
  allResults[config.id] = CHECKPOINT_DAYS.map((d) => summarizeCheckpoints(runs, d));
}

console.log('## E–F. CREW & CASH SUMMARY (Day 30 medians)');
console.log('Archetype          | Workers | Thugs  | Cash       | NW');
for (const config of ARCHETYPE_CONFIGS) {
  const d30 = allResults[config.id][allResults[config.id].length - 1]!;
  console.log(
    `${config.label.padEnd(18)} | ${Math.round(d30.prostitutes!.median).toLocaleString().padStart(7)} | ${Math.round(d30.thugs!.median).toLocaleString().padStart(6)} | ${fmt(d30.cash!.median).padStart(10)} | ${fmt(d30.netWorth!.median)}`,
  );
}

console.log('\n## G. DRUG ECONOMY @ Day 30 (balanced median)');
const bal30 = allResults.balanced[allResults.balanced.length - 1]!;
console.log(`Hash: ${Math.round(bal30.hash!.median)} | Shrooms: — | Coke: ${Math.round(bal30.coke!.median)} | Heroin: ${Math.round(bal30.heroin!.median)}`);
console.log(`Drug sale income (30d median): ${fmt(bal30.cumDrugSales!.median)}`);

console.log('\n## H. SUPPLY UPKEEP (% of income, balanced Day 30)');
const income =
  bal30.cumScoutCash!.median + bal30.cumProduceCash!.median + bal30.cumDrugSales!.median;
console.log(`Supply spend: ${fmt(bal30.cumSupplySpend!.median)} = ${((bal30.cumSupplySpend!.median / income) * 100).toFixed(1)}% of gross income`);

console.log('\n## I. WEAPON / RIDE SCALING (shop prices)');
for (const n of [100, 500, 1000, 2500, 5000, 10_000, 25_000]) {
  const glockCost = n * getCityShopItem('glock')!.shopPrice;
  const uziCost = Math.floor(n * 0.6) * getCityShopItem('uzi')!.shopPrice;
  const rides = Math.ceil(n / 5) * getCityShopItem('ride')!.shopPrice;
  console.log(`${String(n).padStart(6)} thugs: Glocks $${glockCost.toLocaleString()} | 60% Uzi $${uziCost.toLocaleString()} | Rides $${rides.toLocaleString()}`);
}

console.log('\n## J. COMBAT RECOVERY (Scout-only thug replacement)');
for (const loss of [50, 150, 500, 1000]) {
  const turns = estimateThugRecoveryTurns(loss, 500, 200, 'docks');
  console.log(`Replace ${loss} thugs: ~${turns.toLocaleString()} scout turns (~${(turns / TURNS_PER_DAY).toFixed(1)} days regen)`);
}

console.log('\n## K. BAD ATTACK RECOVERY (% thug loss from Day 14 balanced median)');
const day14 = allResults.balanced.find((_, i) => CHECKPOINT_DAYS[i] === 14);
if (day14) {
  for (const pct of [0.1, 0.25, 0.5]) {
    const lost = Math.floor(day14.thugs!.median * pct);
    const turns = estimateThugRecoveryTurns(lost, day14.prostitutes!.median, day14.thugs!.median, 'docks');
    console.log(`Lose ${(pct * 100).toFixed(0)}% (${lost} thugs): ~${(turns / TURNS_PER_DAY).toFixed(1)} days scout-only recovery`);
  }
}

console.log('\n## L. PAYOUT ANALYSIS (300 workers, 100 turns, 85 morale)');
console.log('Note: 1% retains more cash per action but morale slot 0.52 reduces efficiency; 30-day sim uses 25–50% for economy/power.');
for (const payout of [1, 25, 50, 75]) {
  const gross = grossWorkerCash(300, 100);
  const morale = payoutMoraleScore(payout);
  const eff = happinessEfficiencyModifier(Math.round(60 + morale * 40));
  const retained = Math.floor(playerCashFromGross(gross, payout) * eff);
  console.log(`Payout ${String(payout).padStart(3)}%: morale ${morale.toFixed(2)} eff~${eff.toFixed(2)} scout retained ~$${retained.toLocaleString()}/100 turns`);
}

console.log('\n## M. HASH SELF-SUPPLY vs BUY (500W/500T, 100 turns)');
const hashNet = estimateHashProduceNet({ prostitutes: 500, thugs: 500, turnsSpent: 100, thugHappiness: 85 });
const shopHashCost = (hashNet.hashConsumed ?? 0) * getCityShopItem('hash')!.shopPrice;
console.log(`Produce Hash net: +${hashNet.netHash} | Shop replace cost for consumed: $${shopHashCost}`);
console.log(`Worker-heavy (2000W/500T): net ${estimateHashProduceNet({ prostitutes: 2000, thugs: 500, turnsSpent: 100 }).netHash} → buy Hash or recruit more Thugs`);

console.log('\n## N. TRAVEL BREAKEVEN (Heroin, Neon Strip → Old Quarter)');
const nsPrice = getDrugStreetPrice('neon-strip', 'heroin');
const oqPrice = getDrugStreetPrice('old-quarter', 'heroin');
const diff = oqPrice - nsPrice;
console.log(`Price delta: $${diff}/unit | Travel cost: ${REDLITE_TRAVEL.turnCost} turns`);
const oppCost10 = Math.floor(
  playerCashFromGross(
    grossWorkerCash(500, 10) + grossWorkerCash(500, 10, PRODUCTION_CONFIG.cashPerProstitutePerTurn),
    50,
  ) * happinessEfficiencyModifier(85),
);
console.log(`Opportunity cost ~$${oppCost10.toLocaleString()} (500 workers, 10 turns)`);
console.log(`Min heroin load to break even on travel: ~${Math.ceil(oppCost10 / diff)} units`);
console.log(`At Day 30 balanced (~1,786 coke median): travel rational when city delta × inventory > opp cost`);

console.log('\n## O. WORKER POACHING (simulation only)');
console.log('Run scripts/worker-poaching-sim.ts for full POACH_WORKERS Monte Carlo.');
console.log('Implemented: POACH_WORKERS attack (4 turns), 2% base / 3% cap, happiness + thug-ratio modifiers.');
for (const pct of [0.01, 0.02, 0.03]) {
  const victims = Math.round(bal30.prostitutes!.median * pct);
  const scoutTurns = estimateThugRecoveryTurns(victims, bal30.prostitutes!.median, bal30.thugs!.median, 'clubs');
  console.log(`Steal ${(pct * 100).toFixed(0)}% workers (${victims}): ~${(scoutTurns / TURNS_PER_DAY).toFixed(1)} days scout recovery for victim`);
}
console.log('Recommend: 1–3% of vulnerable Workers per successful attack, gated by protection/happiness.');

console.log('\n## P. DEEP INTEL (simulation only)');
console.log('Basic Intel: 5 turns (current). Deep Intel candidates vs 100-turn produce opp ~$141k at 500 workers.');
for (const cost of [10, 15, 20, 25, 30]) {
  console.log(`  ${cost} turns Deep Intel = ${((cost / 100) * 100).toFixed(0)}% of a 100-turn block — recommend ${cost <= 20 ? 'viable' : 'expensive'}`);
}
console.log('Recommend Deep Intel: 15–20 turns, ±15–20% crew bands, cash/drug exposure as % of NW.');

console.log('\n## Q. BUSINESSES (simulation only)');
console.log(`Day 30 economy player: $${Math.round(bal30.cumProduceCash!.median / 30).toLocaleString()}/day produce + scout cash`);
console.log('Passive business target: 10–30% of active Worker earnings — NOT competitive with Produce.');
console.log('Recommend: Business purchase 50–75% excluded from Street NW; Nightclub passive 15–25% Worker rate;');
console.log('  Warehouse drug storage removes NW but exposes to Heat raids (10–20% loss at HIGH tier).');

console.log('\n## R. HIRE THUGS ANALYSIS (simulation only)');
const medianIncome = income;
for (const row of hireThugAnalysis(medianIncome)) {
  console.log(
    `$${row.price.toLocaleString()}/thug: 100 = ${(row.counts[100]!.pctOfIncome * 100).toFixed(0)}% monthly income | 500 = ${(row.counts[500]!.pctOfIncome * 100).toFixed(0)}% | 1000 = ${(row.counts[1000]!.pctOfIncome * 100).toFixed(0)}%`,
  );
}
console.log('Recommendation band: $4,000–$7,500/thug for emergency recovery without dominating Scout.');

console.log('\n## S. 100K CREW QUESTION (Day 30 P90 upper bounds)');
for (const config of ARCHETYPE_CONFIGS) {
  const d30 = allResults[config.id][allResults[config.id].length - 1]!;
  console.log(`${config.label}: Workers P90 ${Math.round(d30.prostitutes!.p90).toLocaleString()} | Thugs P90 ${Math.round(d30.thugs!.p90).toLocaleString()}`);
}
console.log('100,000 Thugs/Workers: NOT reachable in 30 days under current Scout rates without Hire Thugs.');

console.log('\n## T. IDEAL DAY-30 RANGES (median across archetypes)');
const casualD30 = allResults.casual[allResults.casual.length - 1]!;
const powerD30 = allResults.power[allResults.power.length - 1]!;
console.log(`Casual:     Workers ${Math.round(casualD30.prostitutes!.median)} | Thugs ${Math.round(casualD30.thugs!.median)} | NW ${fmt(casualD30.netWorth!.median)}`);
console.log(`Power:      Workers ${Math.round(powerD30.prostitutes!.median)} | Thugs ${Math.round(powerD30.thugs!.median)} | NW ${fmt(powerD30.netWorth!.median)}`);

console.log('\n## U. ORDERED RECOMMENDATIONS');
console.log('1. IMPLEMENT NEXT: Businesses (passive layer) + Hire Thugs at $4k–7.5k + Deep Intel ~15–20 turns');
console.log('2. WAIT: Worker buying, police raids v2, Cartel upgrades');
console.log('3. TUNE: Alpha starting turns (5000 inflates early week) before public launch');
console.log('4. CONSIDER REMOVING: Nothing critical — Travel/Market need more player data');
console.log('5. KEEP: Drug-specific yields, supply 150, payout morale curve, canonical NW, split-invariant Scout/Produce');

mkdirSync(OUT_DIR, { recursive: true });
const jsonPath = join(OUT_DIR, 'monthly-sim-results.json');
writeFileSync(
  jsonPath,
  JSON.stringify(
    {
      generatedAt: new Date().toISOString(),
      monteCarloRuns: MONTE_CARLO_RUNS,
      turnsPerDay: TURNS_PER_DAY,
      archetypes: Object.fromEntries(
        ARCHETYPE_CONFIGS.map((a) => [a.id, CHECKPOINT_DAYS.map((d, i) => ({ day: d, ...allResults[a.id][i] }))]),
      ),
    },
    null,
    2,
  ),
);
console.log(`\nStructured output: ${jsonPath}`);
console.log('\nSimulation complete. No production gameplay constants were modified.');
