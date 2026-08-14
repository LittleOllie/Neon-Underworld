#!/usr/bin/env npx tsx
/**
 * DEV-ONLY: First-day pacing / starting turn bank audit.
 * Uses live game config + engine only. Does not modify production code.
 *
 * Run: npx tsx scripts/first-day-turn-audit.ts
 */
import { writeFileSync } from 'node:fs';
import path from 'node:path';
import { STARTING_RESOURCES, DISTRICTS, TURNS_CONFIG } from '../src/config/game/balance';
import { REDLITE_TURNS } from '../src/config/game/redlite-rules';
import { ATTACK_RULES } from '../src/config/game/attack-rules';
import { THUG_HIRE_PRICE } from '../src/config/game/hire-thugs-rules';
import { getCityShopItem } from '../src/config/game/shop-rules';
import { BUSINESS_TYPE_RULES } from '../src/config/game/business-rules';
import { resolveScouting } from '../src/lib/game-engine/scouting';
import { resolveProduction, type ProductionDrug } from '../src/lib/game-engine/production';
import { resolveSupplyConsumptionForAction } from '../src/lib/game-engine/supply-consumption';
import {
  calculateProstituteHappiness,
  calculateThugHappiness,
} from '../src/lib/game-engine/happiness';
import { calculateCanonicalNetWorthFromPlayer } from '../src/lib/game-engine/canonical-net-worth';
import {
  createInitialState,
  TURNS_PER_DAY,
  type SimState,
} from './lib/monthly-sim/engine';

const WAREHOUSE_PURCHASE_PRICE = BUSINESS_TYPE_RULES.WAREHOUSE.purchasePrice;
const NIGHTCLUB_PURCHASE_PRICE = BUSINESS_TYPE_RULES.NIGHTCLUB.purchasePrice;
const DRUG_LAB_PURCHASE_PRICE = BUSINESS_TYPE_RULES.DRUG_LAB.purchasePrice;

type ScoutAreaSlug = 'streets' | 'clubs' | 'docks' | 'alleys' | 'markets';

function districtModifiers(slug: string) {
  return DISTRICTS.find((d) => d.slug === slug)!.modifiers;
}

function morale(state: SimState) {
  const worker = calculateProstituteHappiness({
    prostitutes: state.prostitutes,
    thugs: state.thugs,
    hash: state.hash,
    condoms: state.condoms,
    prostitutePayoutPercent: state.prostitutePayoutPercent,
  }).score;
  const thug = calculateThugHappiness({
    thugs: state.thugs,
    glocks: state.glocks,
    uzis: state.uzis,
    aks: state.aks,
    beer: state.beer,
  }).score;
  return { worker, thug };
}

function nw(state: SimState): number {
  return calculateCanonicalNetWorthFromPlayer({
    cash: state.cash,
    bankCash: state.bankCash,
    thugs: state.thugs,
    prostitutes: state.prostitutes,
    rides: state.rides,
    hash: state.hash,
    shrooms: state.shrooms,
    coke: state.coke,
    heroin: state.heroin,
  });
}

function applySupply(state: SimState, turns: number): void {
  const result = resolveSupplyConsumptionForAction({
    prostitutes: state.prostitutes,
    thugs: state.thugs,
    turnsSpent: turns,
    condoms: state.condoms,
    hash: state.hash,
    beer: state.beer,
  });
  state.condoms = result.inventoryAfter.condoms;
  state.hash = result.inventoryAfter.hash;
  state.beer = result.inventoryAfter.beer;
}

function doScout(state: SimState, turns: number, area: ScoutAreaSlug, seed: number): void {
  if (turns <= 0 || state.turns < turns) return;
  const m = morale(state);
  const outcome = resolveScouting({
    turnsSpent: turns,
    districtModifiers: districtModifiers(state.district),
    districtSlug: state.district,
    areaSlug: area,
    prostituteHappiness: m.worker,
    thugHappiness: m.thug,
    prostituteCount: state.prostitutes,
    thugCount: state.thugs,
    prostitutePayoutPercent: state.prostitutePayoutPercent,
    seed,
  });
  applySupply(state, turns);
  state.turns -= turns;
  state.turnsSpentTotal += turns;
  state.prostitutes = Math.max(0, state.prostitutes + outcome.prostitutesFound - outcome.prostitutesLost);
  state.thugs = Math.max(0, state.thugs + outcome.thugsFound - outcome.thugsLost);
  state.cash += outcome.cashEarned;
  state.cumScoutCash += outcome.cashEarned;
}

function doProduce(state: SimState, turns: number, drug: ProductionDrug, seed: number): void {
  if (turns <= 0 || state.turns < turns) return;
  const m = morale(state);
  const outcome = resolveProduction({
    turnsSpent: turns,
    thugCount: state.thugs,
    prostituteCount: state.prostitutes,
    prostituteHappiness: m.worker,
    thugHappiness: m.thug,
    prostitutePayoutPercent: state.prostitutePayoutPercent,
    drugType: drug,
    seed,
  });
  applySupply(state, turns);
  state.turns -= turns;
  state.turnsSpentTotal += turns;
  state.prostitutes = Math.max(0, state.prostitutes - outcome.prostitutesLost);
  state.thugs = Math.max(0, state.thugs - outcome.thugsLost);
  state.cash += outcome.cashEarned;
  state.cumProduceCash += outcome.cashEarned;
  if (drug === 'hash') state.hash += outcome.drugUnitsProduced;
  else state[drug] += outcome.drugUnitsProduced;
}

const STARTING_BANKS = [100, 250, 500, 750, 1000, 1500, 2000, 2500, 5000] as const;
const REGEN_TURNS_PER_5MIN = REDLITE_TURNS.turnsPerInterval;
const REGEN_MS_PER_TURN = 1 / REDLITE_TURNS.regenerationRatePerMs;
const TURN_CAP = REDLITE_TURNS.turnCap;

function waitMinutesForTurns(needed: number): number {
  const intervals = Math.ceil(needed / REGEN_TURNS_PER_5MIN);
  return intervals * REDLITE_TURNS.intervalMinutes;
}

function fmtWait(mins: number): string {
  if (mins < 60) return `${mins} min`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

function cloneStart(turns: number): SimState {
  const s = createInitialState('neon-strip');
  s.turns = turns;
  return s;
}

type Day1Archetype =
  | 'clueless'
  | 'balanced'
  | 'scoutHeavy'
  | 'produceHeavy'
  | 'pvpCurious'
  | 'minMax'
  | 'casual'
  | 'binge';

interface SessionPlan {
  scout: number;
  produce: number;
  intel: number;
  travel: number;
  attack: number;
  shopSpend: number;
}

/** Approximate first-session action plans (turn budgets). */
function sessionPlan(archetype: Day1Archetype, bank: number): SessionPlan[] {
  const cap = (n: number) => Math.min(n, bank);
  switch (archetype) {
    case 'clueless':
      return [{ scout: cap(75), produce: cap(25), intel: 0, travel: 0, attack: 0, shopSpend: 500 }];
    case 'balanced':
      return [
        { scout: cap(100), produce: cap(50), intel: 0, travel: 0, attack: 0, shopSpend: 800 },
        { scout: cap(50), produce: cap(100), intel: 5, travel: 0, attack: 0, shopSpend: 400 },
      ];
    case 'scoutHeavy':
      return [{ scout: cap(Math.floor(bank * 0.7)), produce: cap(25), intel: 0, travel: 0, attack: 0, shopSpend: 300 }];
    case 'produceHeavy':
      return [{ scout: cap(50), produce: cap(Math.floor(bank * 0.6)), intel: 0, travel: 0, attack: 0, shopSpend: 600 }];
    case 'pvpCurious':
      return [
        { scout: cap(75), produce: cap(50), intel: 5, travel: 10, attack: 3, shopSpend: 2500 },
      ];
    case 'minMax':
      return [
        { scout: cap(150), produce: cap(100), intel: 0, travel: 0, attack: 0, shopSpend: 500 },
        { scout: cap(100), produce: cap(200), intel: 5, travel: 0, attack: 0, shopSpend: 300 },
      ];
    case 'casual':
      return [{ scout: cap(50), produce: cap(25), intel: 0, travel: 0, attack: 0, shopSpend: 200 }];
    case 'binge':
      return [{ scout: cap(Math.floor(bank * 0.45)), produce: cap(Math.floor(bank * 0.4)), intel: 5, travel: 10, attack: 3, shopSpend: 1500 }];
    default:
      return [{ scout: 50, produce: 25, intel: 0, travel: 0, attack: 0, shopSpend: 0 }];
  }
}

function applySession(state: SimState, plan: SessionPlan, seed: number): void {
  if (plan.scout > 0 && state.turns >= plan.scout) {
    doScout(state, plan.scout, 'streets', seed);
  }
  if (plan.produce > 0 && state.turns >= plan.produce && state.thugs >= 1) {
    doProduce(state, plan.produce, 'hash', seed + 1);
  }
  const misc = plan.intel + plan.travel + plan.attack;
  if (misc > 0 && state.turns >= misc) {
    state.turns -= misc;
    state.turnsSpentTotal += misc;
  }
  if (plan.shopSpend > 0 && state.cash >= plan.shopSpend) {
    state.cash -= plan.shopSpend;
    state.cumSupplySpend += plan.shopSpend * 0.6;
    state.cumWeaponSpend += plan.shopSpend * 0.4;
    if (state.beer < state.thugs * 2) state.beer += 5;
    if (state.condoms < state.prostitutes * 2) state.condoms += 10;
  }
}

function simulateDay1Archetype(bank: number, archetype: Day1Archetype, seed: number) {
  const state = cloneStart(bank);
  const sessions = sessionPlan(archetype, bank);
  let sessionIdx = 0;
  for (const plan of sessions) {
    applySession(state, plan, seed + sessionIdx * 997);
    sessionIdx++;
    if (state.turns <= 0) break;
  }
  return {
    turnsRemaining: state.turns,
    turnsSpent: state.turnsSpentTotal,
    workers: state.prostitutes,
    thugs: state.thugs,
    cash: state.cash,
    netWorth: nw(state),
    reachedProduce: state.cumProduceCash > 0,
    reachedPvp: sessions.some((s) => s.intel > 0 || s.attack > 0) && state.turnsSpentTotal >= 5,
  };
}

function scoutMonteCarlo(turns: number, samples = 2000) {
  const district = DISTRICTS.find((d) => d.slug === 'neon-strip')!.modifiers;
  let zero = 0;
  let workers = 0;
  let thugs = 0;
  let cash = 0;
  for (let i = 0; i < samples; i++) {
    const m = morale(createInitialState('neon-strip'));
    const out = resolveScouting({
      turnsSpent: turns,
      districtModifiers: district,
      districtSlug: 'neon-strip',
      areaSlug: 'streets',
      prostituteHappiness: m.worker,
      thugHappiness: m.thug,
      prostituteCount: STARTING_RESOURCES.prostitutes,
      thugCount: STARTING_RESOURCES.thugs,
      prostitutePayoutPercent: STARTING_RESOURCES.prostitutePayoutPercent,
      seed: 1000 + i * 17 + turns,
    });
    if (out.prostitutesFound + out.thugsFound === 0) zero++;
    workers += out.prostitutesFound;
    thugs += out.thugsFound;
    cash += out.cashEarned;
  }
  return {
    turns,
    zeroPct: (zero / samples) * 100,
    avgWorkers: workers / samples,
    avgThugs: thugs / samples,
    avgCash: cash / samples,
  };
}

function scoutVsProduce(crew: { w: number; t: number }, turns: number) {
  const district = DISTRICTS.find((d) => d.slug === 'neon-strip')!.modifiers;
  const base = {
    prostitutes: crew.w,
    thugs: crew.t,
    glocks: crew.t > 0 ? 1 : 0,
    uzis: 0,
    aks: 0,
    beer: 10,
    condoms: 20,
    hash: 20,
    prostitutePayoutPercent: 50,
  };
  const m = {
    worker: calculateProstituteHappiness({ ...base, thugs: crew.t }).score,
    thug: calculateThugHappiness({ thugs: crew.t, glocks: base.glocks, uzis: 0, aks: 0, beer: 10 }).score,
  };
  const scout = resolveScouting({
    turnsSpent: turns,
    districtModifiers: district,
    districtSlug: 'neon-strip',
    areaSlug: 'clubs',
    prostituteHappiness: m.worker,
    thugHappiness: m.thug,
    prostituteCount: crew.w,
    thugCount: crew.t,
    prostitutePayoutPercent: 50,
    seed: crew.w * 1000 + turns,
  });
  const prod = resolveProduction({
    turnsSpent: turns,
    thugCount: crew.t,
    prostituteCount: crew.w,
    prostituteHappiness: m.worker,
    thugHappiness: m.thug,
    prostitutePayoutPercent: 50,
    drugType: 'hash',
    seed: crew.w * 2000 + turns,
  });
  const scoutValue =
    scout.cashEarned +
    scout.prostitutesFound * 1750 +
    scout.thugsFound * 700;
  const prodValue =
    prod.cashEarned +
    prod.drugUnitsProduced * 5 +
    prod.prostitutesFound * 1750 +
    prod.thugsFound * 700;
  return { scoutValue, prodValue, scoutCrew: scout.prostitutesFound + scout.thugsFound, prodCash: prod.cashEarned };
}

function simulateMultiSessionDay1(bank: number, sessionsPerDay: number) {
  let state = cloneStart(bank);
  const gapHours = 24 / sessionsPerDay;
  const sessionLog: Array<{ after: string; turns: number; workers: number; thugs: number; cash: number; nw: number }> = [];
  for (let s = 0; s < sessionsPerDay; s++) {
    const regen = Math.floor((gapHours * 60) / REDLITE_TURNS.intervalMinutes) * REGEN_TURNS_PER_5MIN;
    if (s > 0) state.turns = Math.min(TURN_CAP, state.turns + regen);
    const spend = Math.min(state.turns, s === 0 ? 100 : Math.min(150, Math.floor(state.turns * 0.4)));
    if (spend >= 25) {
      if (state.prostitutes < 30 || s === 0) doScout(state, Math.floor(spend * 0.55), 'clubs', s * 5000);
      else doProduce(state, Math.floor(spend * 0.55), 'hash', s * 6000);
    }
    sessionLog.push({
      after: `session-${s + 1}`,
      turns: state.turns,
      workers: state.prostitutes,
      thugs: state.thugs,
      cash: state.cash,
      nw: nw(state),
    });
  }
  return sessionLog;
}

function simulateWeek(bank: number, sessionsPerDay: number, activityRate: number) {
  const state = cloneStart(bank);
  for (let day = 1; day <= 7; day++) {
    state.turns = Math.min(TURN_CAP, state.turns + TURNS_PER_DAY);
    const budget = Math.min(state.turns, Math.floor(TURNS_PER_DAY * activityRate * sessionsPerDay / 3));
    if (budget >= 25) {
      doScout(state, Math.floor(budget * 0.5), 'clubs', day * 9000);
      doProduce(state, Math.floor(budget * 0.45), 'hash', day * 9001);
    }
  }
  return { workers: state.prostitutes, thugs: state.thugs, cash: state.cash, nw: nw(state) };
}

function scoreTooMuch(bank: number): Record<string, number> {
  const b = simulateDay1Archetype(bank, 'balanced', bank);
  const binge = simulateDay1Archetype(bank, 'binge', bank + 99);
  return {
    learningOverload: bank >= 2000 ? Math.min(10, 3 + bank / 1500) : bank >= 1000 ? 5 : 2,
    economySkip: bank >= 2500 ? 9 : bank >= 1500 ? 6 : bank >= 750 ? 4 : 2,
    crewInflation: Math.min(10, binge.workers / 40),
    cashInflation: Math.min(10, binge.cash / 50000),
    pvpTooEarly: bank >= 1500 ? 7 : bank >= 750 ? 4 : 2,
    businessTooEarly: bank >= 2000 ? 8 : bank >= 1000 ? 5 : 2,
  };
}

function scoreNotEnough(bank: number): Record<string, number> {
  const c = simulateDay1Archetype(bank, 'casual', bank);
  const cl = simulateDay1Archetype(bank, 'clueless', bank);
  const wait25 = c.turnsRemaining < 25 ? waitMinutesForTurns(25 - c.turnsRemaining) : 0;
  return {
    beforeScoutUnderstood: bank <= 100 ? 8 : bank <= 250 ? 5 : 2,
    beforeProduce: c.reachedProduce ? 2 : bank <= 250 ? 7 : 4,
    beforePurchase: c.cash < 1000 ? (bank <= 250 ? 7 : 4) : 2,
    littleCrew: c.workers < 8 ? (bank <= 250 ? 6 : 3) : 1,
    littleCash: c.cash < 3000 ? (bank <= 500 ? 5 : 2) : 1,
    punishingWait: wait25 > 60 ? 8 : wait25 > 30 ? 5 : 2,
    incompleteSession: c.turnsRemaining <= 0 && bank <= 500 ? 6 : bank <= 250 ? 7 : 2,
  };
}

function retentionScore(bank: number): number {
  const casual = simulateDay1Archetype(bank, 'casual', bank);
  const balanced = simulateDay1Archetype(bank, 'balanced', bank);
  const remaining = balanced.turnsRemaining;
  const waitFor50 = remaining < 50 ? waitMinutesForTurns(50 - remaining) : 0;
  let score = 7;
  if (remaining >= 50 && remaining <= 400) score += 2;
  if (waitFor50 >= 20 && waitFor50 <= 90) score += 1;
  if (casual.reachedProduce) score += 1;
  if (bank >= 2000) score -= 3;
  if (bank <= 100) score -= 3;
  if (remaining > 1500) score -= 2;
  return Math.max(1, Math.min(10, score));
}

function estimateFirstBusinessDay(bank: number): number | null {
  const w = simulateWeek(bank, 3, 0.65);
  if (w.cash >= WAREHOUSE_PURCHASE_PRICE) {
    const dailyIncome = w.workers * 12 * 24 * 0.5 * 0.2;
    const daysToWarehouse = Math.ceil((WAREHOUSE_PURCHASE_PRICE - w.cash) / Math.max(dailyIncome, 1));
    return Math.max(1, 7 + daysToWarehouse);
  }
  const week = simulateWeek(bank, 4, 0.75);
  if (week.cash >= WAREHOUSE_PURCHASE_PRICE * 0.5) return 14;
  if (week.cash >= 500_000) return 21;
  return week.cash >= 100_000 ? 28 : null;
}

function estimateSessionBand(bank: number, archetype: Day1Archetype): string {
  const r = simulateDay1Archetype(bank, archetype, bank);
  const mins = r.turnsSpent * 0.8; // ~0.8 min per turn action batch rough UX
  if (mins < 10) return '<10 min';
  if (mins < 20) return '10–20 min';
  if (mins < 30) return '20–30 min';
  if (mins < 45) return '30–45 min';
  if (mins < 60) return '45–60 min';
  return '60+ min';
}

// --- Run audit ---
console.log('=== LIVE VALUES VERIFIED ===');
console.log(JSON.stringify({
  startingTurnsLive: TURNS_CONFIG.startingTurns,
  turnCap: TURNS_CONFIG.turnCap,
  regen: `${REGEN_TURNS_PER_5MIN} / ${REDLITE_TURNS.intervalMinutes} min`,
  turnsPerDay: TURNS_PER_DAY,
  scoutMinMax: [1, 5000],
  produceMinMax: [1, 5000],
  travel: REDLITE_TURNS.travelTurnCost,
  intelBasic: 5,
  intelDeep: 20,
  attackCosts: ATTACK_RULES.turnCosts,
  startingResources: STARTING_RESOURCES,
  hireThug: THUG_HIRE_PRICE,
  businessPrices: { warehouse: WAREHOUSE_PURCHASE_PRICE, nightclub: NIGHTCLUB_PURCHASE_PRICE, drugLab: DRUG_LAB_PURCHASE_PRICE },
  glock: getCityShopItem('glock')!.shopPrice,
}, null, 2));

console.log('\n=== REGEN WAIT TABLE ===');
for (const need of [10, 25, 50, 100]) {
  console.log(`${need} turns → ${fmtWait(waitMinutesForTurns(need))}`);
}

console.log('\n=== SCOUT MONTE CARLO (starting crew, streets) ===');
const scoutSamples = [10, 25, 50, 75, 100, 150, 250, 500].map((t) => scoutMonteCarlo(t));

console.log('\n=== STARTING BANK MATRIX ===');
const matrix = STARTING_BANKS.map((bank) => {
  const balanced = simulateDay1Archetype(bank, 'balanced', bank);
  const casual = simulateDay1Archetype(bank, 'casual', bank);
  const binge = simulateDay1Archetype(bank, 'binge', bank);
  const remaining = balanced.turnsRemaining;
  const waitNext50 = remaining < 50 ? fmtWait(waitMinutesForTurns(50 - remaining)) : 'already have 50+';
  const week = simulateWeek(bank, 3, 0.55);
  const tooMuch = scoreTooMuch(bank);
  const notEnough = scoreNotEnough(bank);
  return {
    startingTurns: bank,
    firstSessionBalanced: estimateSessionBand(bank, 'balanced'),
    firstSessionCasual: estimateSessionBand(bank, 'casual'),
    day1WorkersBalanced: balanced.workers,
    day1ThugsBalanced: balanced.thugs,
    day1CashBalanced: balanced.cash,
    day1NwBalanced: balanced.netWorth,
    turnsRemainingBalanced: remaining,
    turnsRemainingCasual: casual.turnsRemaining,
    waitFor50TurnScout: waitNext50,
    return3hRegen: Math.min(TURN_CAP - remaining, Math.floor((180 / REDLITE_TURNS.intervalMinutes) * REGEN_TURNS_PER_5MIN)),
    return8hRegen: Math.min(TURN_CAP - remaining, Math.floor((480 / REDLITE_TURNS.intervalMinutes) * REGEN_TURNS_PER_5MIN)),
    firstBusinessDayEst: estimateFirstBusinessDay(bank),
    pvpReadyDay1: balanced.reachedPvp,
    tooMuchAvg: Object.values(tooMuch).reduce((a, b) => a + b, 0) / 6,
    notEnoughAvg: Object.values(notEnough).reduce((a, b) => a + b, 0) / 7,
    retentionScore: retentionScore(bank),
    day7NwCasual: simulateWeek(bank, 2, 0.3).nw,
    day7NwActive: simulateWeek(bank, 5, 0.85).nw,
  };
});

console.table(matrix.map((m) => ({
  bank: m.startingTurns,
  sess: m.firstSessionBalanced,
  W: m.day1WorkersBalanced,
  T: m.day1ThugsBalanced,
  cash: Math.round(m.day1CashBalanced),
  left: m.turnsRemainingBalanced,
  wait50: m.waitFor50TurnScout,
  ret: m.retentionScore,
  D7casual: Math.round(m.day7NwCasual / 1000) + 'k',
})));

const output = {
  generatedAt: new Date().toISOString(),
  liveValues: {
    startingTurns: TURNS_CONFIG.startingTurns,
    turnCap: TURN_CAP,
    regenPer5Min: REGEN_TURNS_PER_5MIN,
    turnsPerDay: TURNS_PER_DAY,
  },
  regenWaits: [10, 25, 50, 100].map((n) => ({ turns: n, waitMinutes: waitMinutesForTurns(n) })),
  scoutMonteCarlo: scoutSamples,
  matrix,
  multiSession750: simulateMultiSessionDay1(750, 4),
  multiSession500: simulateMultiSessionDay1(500, 3),
  multiSession1000: simulateMultiSessionDay1(1000, 3),
  scoutVsProduce: [
    { crew: '2W/1T start', turns: 25, ...scoutVsProduce({ w: 2, t: 1 }, 25) },
    { crew: '10W/5T', turns: 50, ...scoutVsProduce({ w: 10, t: 5 }, 50) },
    { crew: '25W/10T', turns: 100, ...scoutVsProduce({ w: 25, t: 10 }, 100) },
    { crew: '50W/25T', turns: 100, ...scoutVsProduce({ w: 50, t: 25 }, 100) },
  ],
  capFillFromEmpty: {
    hoursToCap: (TURN_CAP / REGEN_TURNS_PER_5MIN) * (REDLITE_TURNS.intervalMinutes / 60),
    daysOffline1: Math.min(TURN_CAP, TURNS_PER_DAY),
    daysOffline3: Math.min(TURN_CAP, TURNS_PER_DAY * 3),
    daysOffline7: TURN_CAP,
  },
};

const outPath = path.join(__dirname, 'output/first-day-turn-audit.json');
writeFileSync(outPath, JSON.stringify(output, null, 2));
console.log(`\nWrote ${outPath}`);
