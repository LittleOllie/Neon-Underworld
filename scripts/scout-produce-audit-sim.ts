/**
 * READ-ONLY Scout + Produce economy audit simulation.
 * Run: npx tsx scripts/scout-produce-audit-sim.ts
 */
import { resolveScouting } from '../src/lib/game-engine/scouting';
import { resolveProduction } from '../src/lib/game-engine/production';
import {
  DISTRICTS,
  SCOUTING_CONFIG,
  PRODUCTION_CONFIG,
  STARTING_RESOURCES,
  TURNS_CONFIG,
  HAPPINESS_EFFICIENCY,
} from '../src/config/game/balance';
import { REDLITE_SCOUT_AREAS, REDLITE_TURNS } from '../src/config/game/redlite-rules';
import { DRUG_PRODUCTION_RATES } from '../src/config/game/drug-production-rates';
import {
  planSupplyConsumption,
  SUPPLY_CREW_TURNS_PER_UNIT,
} from '../src/config/game/supply-economy';
import {
  estimateHashProduceNet,
  estimateDrugUnitsProduced,
} from '../src/lib/game-engine/produce-economy';
import {
  calculateProstituteHappiness,
  calculateThugHappiness,
  happinessEfficiencyModifier,
  happinessRecruitmentModifier,
} from '../src/lib/game-engine/happiness';
import { grossWorkerCash, playerCashFromGross } from '../src/lib/game-engine/worker-economics';
import { getCityShopItem } from '../src/config/game/shop-rules';
import { getDrugStreetPrice } from '../src/config/game/drug-street-prices';
import { REDLITE_NET_WORTH } from '../src/config/game/redlite-rules';
import type { ProductionDrug } from '../src/lib/game-engine/production';

const NW = REDLITE_NET_WORTH;
const DAILY_TURNS = REDLITE_TURNS.regenerationRatePerHour * 24; // 576

function pct(n: number, d: number) {
  return d === 0 ? 0 : (n / d) * 100;
}

function stats(values: number[]) {
  const sorted = [...values].sort((a, b) => a - b);
  const n = sorted.length;
  const sum = sorted.reduce((a, b) => a + b, 0);
  const q = (p: number) => sorted[Math.min(n - 1, Math.floor(p * (n - 1)))] ?? 0;
  return {
    mean: sum / n,
    median: q(0.5),
    p10: q(0.1),
    p25: q(0.25),
    p75: q(0.75),
    p90: q(0.9),
    min: sorted[0] ?? 0,
    max: sorted[n - 1] ?? 0,
  };
}

function probCounts(values: number[]) {
  const n = values.length;
  return {
    zero: pct(values.filter((v) => v === 0).length, n),
    one: pct(values.filter((v) => v === 1).length, n),
    two: pct(values.filter((v) => v === 2).length, n),
    threePlus: pct(values.filter((v) => v >= 3).length, n),
    unusuallyLarge: pct(values.filter((v) => v >= 10).length, n),
  };
}

function scoutSim(
  turns: number,
  districtSlug: string,
  areaSlug: string,
  samples: number,
  happiness: number,
  prostitutes: number,
  thugs: number,
  seedBase: number,
  includeWalkouts = false,
) {
  const district = DISTRICTS.find((d) => d.slug === districtSlug)!;
  const workers: number[] = [];
  const thugsOut: number[] = [];
  const cash: number[] = [];

  for (let i = 0; i < samples; i++) {
    const r = resolveScouting({
      turnsSpent: turns,
      districtModifiers: district.modifiers,
      districtSlug,
      areaSlug,
      prostituteHappiness: happiness,
      thugHappiness: happiness,
      prostituteCount: prostitutes,
      thugCount: thugs,
      prostitutePayoutPercent: 50,
      seed: seedBase + i,
    });
    workers.push(r.prostitutesFound);
    thugsOut.push(r.thugsFound);
    cash.push(r.cashEarned);
  }

  return { workers, thugs: thugsOut, cash, total: workers.map((w, i) => w + thugs[i]!) };
}

function workerRatePer100(districtSlug: string, areaSlug: string, happiness: number) {
  const district = DISTRICTS.find((d) => d.slug === districtSlug)!;
  const area = REDLITE_SCOUT_AREAS.find((a) => a.slug === areaSlug)!;
  const mod = happinessRecruitmentModifier(happiness, happiness);
  return (
    SCOUTING_CONFIG.baseProstitutesPerTurn *
    district.modifiers.prostituteRecruitment *
    area.prostituteRecruitment *
    mod *
    100
  );
}

function thugRatePer100(districtSlug: string, areaSlug: string, happiness: number) {
  const district = DISTRICTS.find((d) => d.slug === districtSlug)!;
  const area = REDLITE_SCOUT_AREAS.find((a) => a.slug === areaSlug)!;
  const mod = happinessRecruitmentModifier(happiness, happiness);
  return (
    SCOUTING_CONFIG.baseThugsPerTurn *
    district.modifiers.thugRecruitment *
    area.thugRecruitment *
    mod *
    100
  );
}

function scoutValue(workers: number, thugs: number, cash: number) {
  return cash + workers * NW.prostitutes + thugs * NW.thugs;
}

type Playstyle = {
  name: string;
  sessionsPerDay: number;
  turnSpendPct: number;
  scoutPct: number;
};

const PLAYSTYLES: Playstyle[] = [
  { name: 'Casual', sessionsPerDay: 1, turnSpendPct: 0.32, scoutPct: 0.5 },
  { name: 'Regular', sessionsPerDay: 2.5, turnSpendPct: 0.68, scoutPct: 0.5 },
  { name: 'Active', sessionsPerDay: 5, turnSpendPct: 0.9, scoutPct: 0.5 },
  { name: 'Scout-heavy', sessionsPerDay: 3, turnSpendPct: 0.75, scoutPct: 0.75 },
  { name: 'Balanced', sessionsPerDay: 3, turnSpendPct: 0.75, scoutPct: 0.5 },
  { name: 'Produce-heavy', sessionsPerDay: 3, turnSpendPct: 0.75, scoutPct: 0.25 },
  { name: 'Extreme Scout', sessionsPerDay: 5, turnSpendPct: 0.95, scoutPct: 1.0 },
  { name: 'Min-max Active', sessionsPerDay: 6, turnSpendPct: 0.95, scoutPct: 0.6 },
];

function simulatePlaystyle(
  style: Playstyle,
  days: number,
  districtSlug: string,
  areaSlug: string,
  seedBase: number,
) {
  let workers = STARTING_RESOURCES.prostitutes;
  let thugs = STARTING_RESOURCES.thugs;
  let cash = STARTING_RESOURCES.cash;
  let hash = STARTING_RESOURCES.hash;
  let condoms = STARTING_RESOURCES.condoms;
  let beer = STARTING_RESOURCES.beer;
  let turns = TURNS_CONFIG.startingTurns;
  let seed = seedBase;

  const snapshots: Record<number, { workers: number; thugs: number; cash: number; nw: number }> = {};

  for (let day = 1; day <= days; day++) {
    turns = Math.min(TURNS_CONFIG.turnCap, turns + DAILY_TURNS);
    const dailyBudget = Math.floor(turns * style.turnSpendPct);
    turns -= dailyBudget;

    const scoutTurns = Math.floor((dailyBudget * style.scoutPct) / style.sessionsPerDay) * style.sessionsPerDay;
    const produceTurns = dailyBudget - scoutTurns;
    const scoutPerSession = style.sessionsPerDay > 0 ? Math.floor(scoutTurns / style.sessionsPerDay) : 0;
    const producePerSession =
      style.sessionsPerDay > 0 ? Math.floor(produceTurns / style.sessionsPerDay) : 0;

    for (let s = 0; s < style.sessionsPerDay; s++) {
      if (scoutPerSession >= 1) {
        const inv = { condoms, hash, beer };
        const plan = planSupplyConsumption(workers, thugs, scoutPerSession, inv);
        condoms = Math.max(0, condoms - (plan.consumed.condoms ?? 0));
        hash = Math.max(0, hash - (plan.consumed.hash ?? 0));
        beer = Math.max(0, beer - (plan.consumed.beer ?? 0));
        const wHappy = calculateProstituteHappiness({
          prostitutes: workers,
          thugs,
          hash,
          condoms,
          prostitutePayoutPercent: 50,
        }).score;
        const tHappy = calculateThugHappiness({
          thugs,
          glocks: 1,
          uzis: 0,
          aks: 0,
          beer,
        }).score;
        const r = resolveScouting({
          turnsSpent: scoutPerSession,
          districtModifiers: DISTRICTS.find((d) => d.slug === districtSlug)!.modifiers,
          districtSlug,
          areaSlug,
          prostituteHappiness: wHappy,
          thugHappiness: tHappy,
          prostituteCount: workers,
          thugCount: thugs,
          prostitutePayoutPercent: 50,
          seed: seed++,
        });
        workers = Math.max(0, workers + r.prostitutesFound - r.prostitutesLost);
        thugs = Math.max(0, thugs + r.thugsFound - r.thugsLost);
        cash += r.cashEarned;
      }

      if (producePerSession >= 1 && thugs >= 1) {
        const inv = { condoms, hash, beer };
        const plan = planSupplyConsumption(workers, thugs, producePerSession, inv, {
          exemptWorkerHash: true,
        });
        condoms = Math.max(0, condoms - (plan.consumed.condoms ?? 0));
        beer = Math.max(0, beer - (plan.consumed.beer ?? 0));
        const wHappy = calculateProstituteHappiness({
          prostitutes: workers,
          thugs,
          hash,
          condoms,
          prostitutePayoutPercent: 50,
          exemptHashMorale: true,
        }).score;
        const tHappy = calculateThugHappiness({
          thugs,
          glocks: 1,
          uzis: 0,
          aks: 0,
          beer,
        }).score;
        const r = resolveProduction({
          turnsSpent: producePerSession,
          thugCount: thugs,
          prostituteCount: workers,
          prostituteHappiness: wHappy,
          thugHappiness: tHappy,
          prostitutePayoutPercent: 50,
          drugType: 'hash',
          seed: seed++,
        });
        workers = Math.max(0, workers - r.prostitutesLost);
        thugs = Math.max(0, thugs - r.thugsLost);
        cash += r.cashEarned;
        hash = hash + r.drugUnitsProduced;
      }
    }

    // Simplified resupply: buy to cover next day at 80% morale (approx)
    const nextDaySpend = Math.floor(DAILY_TURNS * style.turnSpendPct);
    const workerUnits = Math.ceil((workers * nextDaySpend) / SUPPLY_CREW_TURNS_PER_UNIT);
    const thugUnits = Math.ceil((thugs * nextDaySpend) / SUPPLY_CREW_TURNS_PER_UNIT);
    const hashNeed = Math.max(0, workerUnits - hash);
    const condomNeed = Math.max(0, workerUnits - condoms);
    const beerNeed = Math.max(0, thugUnits - beer);
    const resupplyCost =
      hashNeed * getCityShopItem('hash')!.shopPrice +
      condomNeed * getCityShopItem('condom')!.shopPrice +
      beerNeed * getCityShopItem('beer')!.shopPrice;
    if (cash >= resupplyCost) {
      cash -= resupplyCost;
      hash += hashNeed;
      condoms += condomNeed;
      beer += beerNeed;
    }

    const nw = cash + workers * NW.prostitutes + thugs * NW.thugs + hash * NW.hash;
    if ([1, 7, 30, 90].includes(day)) {
      snapshots[day] = { workers, thugs, cash, nw };
    }
  }

  return snapshots;
}

function monteCarloPlaystyle(style: Playstyle, days: number, runs: number, seedBase: number) {
  const results: Record<number, number[]> = { 1: [], 7: [], 30: [], 90: [] };
  for (let run = 0; run < runs; run++) {
    const snap = simulatePlaystyle(style, days, 'neon-strip', 'clubs', seedBase + run * 10_000);
    for (const d of [1, 7, 30, 90] as const) {
      if (snap[d]) results[d]!.push(snap[d]!.workers + snap[d]!.thugs);
    }
  }
  return results;
}

// ─── OUTPUT ───────────────────────────────────────────────────────────────

console.log('═══════════════════════════════════════════════════════════════');
console.log(' SCOUT + PRODUCE ECONOMY AUDIT — LIVE VALUES');
console.log('═══════════════════════════════════════════════════════════════\n');

console.log('TURNS');
console.log(`  startingTurns: ${TURNS_CONFIG.startingTurns}`);
console.log(`  turnCap: ${TURNS_CONFIG.turnCap}`);
console.log(`  regen: ${REDLITE_TURNS.turnsPerInterval} every ${REDLITE_TURNS.intervalMinutes}min = ${REDLITE_TURNS.regenerationRatePerHour}/hr = ${DAILY_TURNS}/day`);
console.log(`  scout min/max: ${TURNS_CONFIG.minScoutSpend}/${TURNS_CONFIG.maxScoutSpend}`);
console.log(`  produce min/max: ${PRODUCTION_CONFIG.minTurnSpend}/${PRODUCTION_CONFIG.maxTurnSpend}`);
console.log(`  suggested scout: ${TURNS_CONFIG.suggestedAmounts.join(', ')}`);

console.log('\nSCOUT RECRUITMENT');
console.log(`  baseProstitutesPerTurn: ${SCOUTING_CONFIG.baseProstitutesPerTurn} (${(SCOUTING_CONFIG.baseProstitutesPerTurn * 100).toFixed(2)}%/turn)`);
console.log(`  baseThugsPerTurn: ${SCOUTING_CONFIG.baseThugsPerTurn} (${(SCOUTING_CONFIG.baseThugsPerTurn * 100).toFixed(2)}%/turn)`);
console.log(`  variance: ${SCOUTING_CONFIG.varianceMin}–${SCOUTING_CONFIG.varianceMax}`);
console.log(`  happiness recruitment mod: ${SCOUTING_CONFIG.happinessRecruitmentMin}–${SCOUTING_CONFIG.happinessRecruitmentMax}`);
console.log(`  scout cash/worker/turn: $${SCOUTING_CONFIG.cashPerProstitutePerTurn}`);

console.log('\nPRODUCE');
console.log(`  cash/worker/turn: $${PRODUCTION_CONFIG.cashPerProstitutePerTurn}`);
for (const [d, r] of Object.entries(DRUG_PRODUCTION_RATES)) {
  console.log(`  ${d} rate/thug/turn: ${r}`);
}

console.log('\nSTARTING RESOURCES');
console.log(JSON.stringify(STARTING_RESOURCES, null, 2));

console.log('\nSUPPLY');
console.log(`  crew-turns per unit: ${SUPPLY_CREW_TURNS_PER_UNIT}`);
console.log('  workers consume: condoms + hash (equal)');
console.log('  thugs consume: beer');

console.log('\nNW VALUES');
console.log(`  worker $${NW.prostitutes}, thug $${NW.thugs}, drug unit $${NW.hash}, cash $${NW.cash}`);

// ─── 25-TURN SCOUT (CLUBS = highest worker area) ─────────────────────────

console.log('\n═══════════════════════════════════════════════════════════════');
console.log(' 25-TURN SCOUT — Neon Strip + Clubs (highest worker area)');
console.log(' 10,000 samples, fresh account crew (2W/1T), 100% morale');
console.log('═══════════════════════════════════════════════════════════════\n');

const TURN_LEVELS = [10, 25, 50, 100, 250, 500];
for (const turns of TURN_LEVELS) {
  const { workers, thugs } = scoutSim(turns, 'neon-strip', 'clubs', 10_000, 100, 2, 1, turns * 1000);
  const ws = stats(workers);
  const ts = stats(thugs);
  const wp = probCounts(workers);
  const tp = probCounts(thugs);
  console.log(`--- ${turns} Turns ---`);
  console.log(
    `WORKERS: mean=${ws.mean.toFixed(2)} med=${ws.median} p10=${ws.p10} p25=${ws.p25} p75=${ws.p75} p90=${ws.p90} min=${ws.min} max=${ws.max}`,
  );
  console.log(
    `  P(0)=${wp.zero.toFixed(1)}% P(1)=${wp.one.toFixed(1)}% P(2)=${wp.two.toFixed(1)}% P(3+)=${wp.threePlus.toFixed(1)}% P(10+)=${wp.unusuallyLarge.toFixed(2)}%`,
  );
  console.log(
    `THUGS:   mean=${ts.mean.toFixed(2)} med=${ts.median} p10=${ts.p10} p25=${ts.p25} p75=${ts.p75} p90=${ts.p90} min=${ts.min} max=${ts.max}`,
  );
  console.log(
    `  P(0)=${tp.zero.toFixed(1)}% P(1)=${tp.one.toFixed(1)}% P(2)=${tp.two.toFixed(1)}% P(3+)=${tp.threePlus.toFixed(1)}%`,
  );
  console.log('');
}

const w25 = scoutSim(25, 'neon-strip', 'clubs', 10_000, 100, 2, 1, 25000).workers;
const w25s = stats(w25);
const w25p = probCounts(w25);
console.log('ANSWER: Is 2 workers from 25 Turns bad?');
console.log(`  At Clubs (best worker area), 100% morale, fresh 2W/1T:`);
console.log(`  Mean=${w25s.mean.toFixed(2)}, Median=${w25s.median}, P(exactly 2)=${w25p.two.toFixed(1)}%`);
console.log(`  Verdict: ${w25s.mean >= 2.5 && w25p.two > 15 ? 'SLIGHTLY BELOW AVERAGE but normal variance' : w25s.mean <= 2.5 ? 'AT OR BELOW MEAN — normal RNG' : 'ABOVE AVERAGE'}`);
console.log(`  Expected workers (no variance) ≈ ${(workerRatePer100('neon-strip', 'clubs', 100) * 25 / 100).toFixed(2)}`);

// ─── LOCATION COMPARISON ─────────────────────────────────────────────────

console.log('\n═══════════════════════════════════════════════════════════════');
console.log(' LOCATION COMPARISON (Neon Strip, 100% morale, per 100 Turns)');
console.log('═══════════════════════════════════════════════════════════════\n');

interface AreaRow {
  area: string;
  workers100: number;
  thugs100: number;
  cash100: number;
  ratio: number;
}
const areaRows: AreaRow[] = [];
for (const area of REDLITE_SCOUT_AREAS) {
  const w100 = workerRatePer100('neon-strip', area.slug, 100);
  const t100 = thugRatePer100('neon-strip', area.slug, 100);
  const eff = happinessEfficiencyModifier(100);
  const cash100 = Math.floor(playerCashFromGross(grossWorkerCash(10, 100), 50) * eff);
  areaRows.push({
    area: area.slug,
    workers100: w100,
    thugs100: t100,
    cash100,
    ratio: t100 > 0 ? w100 / t100 : 0,
  });
}
areaRows.sort((a, b) => b.workers100 - a.workers100);
console.log('Area       | W/100T | T/100T | Cash/100T (10W) | W:T ratio');
for (const r of areaRows) {
  console.log(
    `${r.area.padEnd(10)} | ${r.workers100.toFixed(2).padStart(6)} | ${r.thugs100.toFixed(2).padStart(6)} | $${String(r.cash100).padStart(14)} | ${r.ratio.toFixed(2)}`,
  );
}
console.log('\nRanking: Worker-focused →', areaRows.map((r) => r.area).join(' > '));
console.log('Thug-focused → docks > alleys > ... > clubs');

// ─── DAILY TURN ECONOMY ──────────────────────────────────────────────────

console.log('\n═══════════════════════════════════════════════════════════════');
console.log(' DAILY TURN REGEN');
console.log('═══════════════════════════════════════════════════════════════\n');
for (const hours of [1, 4, 8, 12, 24, 24 * 7, 24 * 30]) {
  const turns = Math.min(TURNS_CONFIG.turnCap, Math.floor(REDLITE_TURNS.regenerationRatePerHour * hours));
  console.log(`${String(hours).padStart(4)}h → ${turns} turns (cap ${TURNS_CONFIG.turnCap})`);
}
console.log(`\nOne full day (576 turns) at Clubs, 100% morale, 2W/1T:`);
const dayScout = scoutSim(576, 'neon-strip', 'clubs', 2000, 100, 2, 1, 80000);
console.log(`  Expected workers: ${stats(dayScout.workers).mean.toFixed(1)}`);
console.log(`  Expected thugs: ${stats(dayScout.thugs).mean.toFixed(1)}`);

// ─── HASH SELF-CONSUMPTION ───────────────────────────────────────────────

console.log('\n═══════════════════════════════════════════════════════════════');
console.log(' HASH SELF-CONSUMPTION AUDIT');
console.log('═══════════════════════════════════════════════════════════════\n');
console.log(`Break-even thug:worker ratio ≈ ${(1 / 150 / 0.012).toFixed(3)} (~1 thug per 1.8 workers)\n`);

const CREWS = [
  [1, 2],
  [10, 10],
  [50, 50],
  [100, 100],
  [500, 500],
  [1000, 1000],
] as const;
const PROD_TURNS = [25, 50, 100, 250, 500, 1000];
console.log('Crew (T/W) | Turns | Produced | Consumed | Net | Verdict');
for (const [t, w] of CREWS) {
  for (const turns of PROD_TURNS) {
    const { hashProduced, hashConsumed, netHash } = estimateHashProduceNet({
      prostitutes: w,
      thugs: t,
      turnsSpent: turns,
      thugHappiness: 85,
    });
    const verdict = netHash < 0 ? 'NET NEGATIVE' : 'OK';
    if (turns === 100 || netHash < 0) {
      console.log(
        `${String(t + 'T/' + w + 'W').padEnd(10)} | ${String(turns).padStart(5)} | ${String(hashProduced).padStart(8)} | ${String(hashConsumed).padStart(8)} | ${String(netHash).padStart(4)} | ${verdict}`,
      );
    }
  }
}

// ─── CROSS-DRUG (no self consumption except hash supply) ─────────────────

console.log('\n═══════════════════════════════════════════════════════════════');
console.log(' DRUG PRODUCE — gross units @ 100T/100T/85 morale (no hash supply issue)');
console.log('═══════════════════════════════════════════════════════════════\n');
for (const drug of ['hash', 'shrooms', 'coke', 'heroin'] as ProductionDrug[]) {
  const units = estimateDrugUnitsProduced({ turnsSpent: 100, thugCount: 100, drugType: drug, thugHappiness: 85 });
  const street = getDrugStreetPrice('neon-strip', drug) * units;
  const nw = units * 5;
  console.log(`${drug}: ${units} units, street $${street}, NW $${nw}`);
}

// ─── ONBOARDING SCOUT 25 ─────────────────────────────────────────────────

console.log('\n═══════════════════════════════════════════════════════════════');
console.log(' ONBOARDING — fresh account (2W/1T, Clubs, 100% morale)');
console.log('═══════════════════════════════════════════════════════════════\n');
for (const turns of [10, 25, 50]) {
  const sim = scoutSim(turns, 'neon-strip', 'clubs', 5000, 100, 2, 1, 120000 + turns);
  const w = stats(sim.workers);
  const t = stats(sim.thugs);
  const c = stats(sim.cash);
  const zero = pct(sim.total.filter((x) => x === 0).length, 5000);
  console.log(
    `${turns}T: avg W=${w.mean.toFixed(2)} T=${t.mean.toFixed(2)} total=${(w.mean + t.mean).toFixed(2)} zero=${zero.toFixed(1)}% cash=$${c.mean.toFixed(0)}`,
  );
}

// ─── SCOUT VS PRODUCE CROSSOVER ──────────────────────────────────────────

console.log('\n═══════════════════════════════════════════════════════════════');
console.log(' SCOUT vs PRODUCE value @ 100 Turns, 85 morale (NW valuation)');
console.log('═══════════════════════════════════════════════════════════════\n');
console.log('Crew      | Scout NW value | Produce hash NW | Produce cash');
for (const [t, w] of [
  [1, 2],
  [5, 10],
  [10, 25],
  [25, 50],
  [50, 100],
  [100, 250],
  [250, 500],
  [500, 1000],
] as const) {
  const scout = scoutSim(100, 'neon-strip', 'clubs', 500, 85, w, t, 200000 + w);
  const sw = stats(scout.workers).mean;
  const st = stats(scout.thugs).mean;
  const sc = stats(scout.cash).mean;
  const scoutVal = scoutValue(sw, st, sc);
  const prod = estimateHashProduceNet({ prostitutes: w, thugs: t, turnsSpent: 100, thugHappiness: 85 });
  const prodCash = Math.floor(
    playerCashFromGross(grossWorkerCash(w, 100, 12), 50) * happinessEfficiencyModifier(85),
  );
  const prodVal = prod.netHash * NW.hash + prodCash;
  console.log(
    `${String(t + 'T/' + w + 'W').padEnd(9)} | $${Math.round(scoutVal).toLocaleString().padStart(12)} | $${Math.round(prodVal).toLocaleString().padStart(14)} | $${prodCash.toLocaleString()}`,
  );
}

// ─── SPLIT INVARIANCE ────────────────────────────────────────────────────

console.log('\n═══════════════════════════════════════════════════════════════');
console.log(' SPLIT INVARIANCE (500 scout turns, 100W/40T, 80 morale, 500 samples each)');
console.log('═══════════════════════════════════════════════════════════════\n');
function splitScout(parts: number[], seedBase: number) {
  const totals: number[] = [];
  for (let s = 0; s < 500; s++) {
    let w = 0;
    let t = 0;
    parts.forEach((turns, idx) => {
      const r = resolveScouting({
        turnsSpent: turns,
        districtModifiers: DISTRICTS.find((d) => d.slug === 'neon-strip')!.modifiers,
        areaSlug: 'clubs',
        prostituteHappiness: 80,
        thugHappiness: 80,
        prostituteCount: 100,
        thugCount: 40,
        prostitutePayoutPercent: 50,
        seed: seedBase + s * 20 + idx,
      });
      w += r.prostitutesFound;
      t += r.thugsFound;
    });
    totals.push(w + t);
  }
  return stats(totals);
}
const splits = [
  ['1×500', [500]],
  ['10×50', Array(10).fill(50)],
  ['20×25', Array(20).fill(25)],
];
for (const [label, parts] of splits) {
  const s = splitScout(parts as number[], 300000);
  console.log(`${label}: mean total recruits=${s.mean.toFixed(2)} (med=${s.median})`);
}

// ─── ZERO REWARD ─────────────────────────────────────────────────────────

console.log('\n═══════════════════════════════════════════════════════════════');
console.log(' ZERO-REWARD PROBABILITY (Clubs, fresh 2W/1T)');
console.log('═══════════════════════════════════════════════════════════════\n');
for (const turns of [5, 10, 25, 50]) {
  for (const happy of [100, 80, 60, 40]) {
    const sim = scoutSim(turns, 'neon-strip', 'clubs', 5000, happy, 2, 1, 400000 + turns * 10 + happy);
    const z = pct(sim.total.filter((x) => x === 0).length, 5000);
    console.log(`${turns}T @ ${happy}% morale: P(zero total recruits)=${z.toFixed(2)}%`);
  }
}

// ─── 7-DAY PLAYSTYLE MC (200 runs) ───────────────────────────────────────

console.log('\n═══════════════════════════════════════════════════════════════');
console.log(' 7-DAY PLAYSTYLE MC (200 runs, Neon Strip Clubs, with resupply)');
console.log('═══════════════════════════════════════════════════════════════\n');
console.log('Style          | D1 crew med (p10–p90) | D7 crew med (p10–p90) | D30 crew med');
for (const style of PLAYSTYLES) {
  const d1 = monteCarloPlaystyle(style, 7, 200, 500000)[1]!;
  const d7 = monteCarloPlaystyle(style, 7, 200, 500000)[7]!;
  const d30 = monteCarloPlaystyle(style, 30, 200, 600000)[30]!;
  const s1 = stats(d1);
  const s7 = stats(d7);
  const s30 = stats(d30);
  console.log(
    `${style.name.padEnd(14)} | ${s1.median.toFixed(0).padStart(4)} (${s1.p10.toFixed(0)}–${s1.p90.toFixed(0)})`.padEnd(30) +
      ` | ${s7.median.toFixed(0).padStart(4)} (${s7.p10.toFixed(0)}–${s7.p90.toFixed(0)})`.padEnd(30) +
      ` | ${s30.median.toFixed(0)} (${s30.p10.toFixed(0)}–${s30.p90.toFixed(0)})`,
  );
}

// ─── CASUAL VS ACTIVE ────────────────────────────────────────────────────

console.log('\n═══════════════════════════════════════════════════════════════');
console.log(' CASUAL vs ACTIVE ratios (median crew, 200 MC runs, D30)');
console.log('═══════════════════════════════════════════════════════════════\n');
const casual = stats(monteCarloPlaystyle(PLAYSTYLES[0]!, 30, 200, 700000)[30]!);
const active = stats(monteCarloPlaystyle(PLAYSTYLES[2]!, 30, 200, 710000)[30]!);
console.log(`Casual D30 crew median: ${casual.median.toFixed(0)} (p10–p90: ${casual.p10.toFixed(0)}–${casual.p90.toFixed(0)})`);
console.log(`Active D30 crew median: ${active.median.toFixed(0)} (p10–p90: ${active.p10.toFixed(0)}–${active.p90.toFixed(0)})`);
console.log(`Ratio Active/Casual: ${(active.median / Math.max(casual.median, 1)).toFixed(2)}×`);

// ─── MISSED DAYS ─────────────────────────────────────────────────────────

console.log('\n═══════════════════════════════════════════════════════════════');
console.log(' MISSED DAYS (Regular playstyle, turns accumulate to cap)');
console.log('═══════════════════════════════════════════════════════════════\n');
function missedDays(missDays: number) {
  let turns = 5000;
  // 30 days regular minus miss
  const activeDays = 30 - missDays;
  for (let d = 0; d < 30; d++) {
    turns = Math.min(5000, turns + DAILY_TURNS);
    if (d >= missDays) {
      const spend = Math.floor(turns * 0.68);
      turns -= spend;
    }
  }
  return turns;
}
console.log(`Turns banked after 30d with 0 miss: ~${missedDays(0)} spent pattern`);
for (const miss of [1, 3, 7]) {
  console.log(`Miss ${miss}d then return: still at cap=${TURNS_CONFIG.turnCap}, lost ~${miss * DAILY_TURNS} turns of spend opportunity`);
}

// ─── SHOP QUANTITY ───────────────────────────────────────────────────────

console.log('\n═══════════════════════════════════════════════════════════════');
console.log(' SHOP / SUPPLY SCALE');
console.log('═══════════════════════════════════════════════════════════════\n');
console.log('Shop buy max per transaction: 1000 (validation schema)');
console.log('Supply units per 100 turns @ crew size:');
for (const crew of [100, 500, 1000, 5000, 10000]) {
  const units = Math.ceil((crew * 100) / SUPPLY_CREW_TURNS_PER_UNIT);
  const buys = Math.ceil(units / 1000);
  console.log(`  ${crew} crew: ${units} hash+condoms + ${units} beer per 100T → ${buys} max-cap shop trips`);
}

console.log('\nDone.');
