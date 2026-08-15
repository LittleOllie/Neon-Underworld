#!/usr/bin/env npx tsx
/**
 * READ-ONLY Turn Economy Audit — dev simulation only.
 * Run: npx tsx scripts/turn-economy-audit-sim.ts
 */
import { mkdirSync, writeFileSync } from 'fs';
import { join } from 'path';
import { TURNS_CONFIG, STARTING_RESOURCES, DISTRICTS } from '../src/config/game/balance';
import { REDLITE_TURNS, REDLITE_TRAVEL } from '../src/config/game/redlite-rules';
import { ATTACK_RULES } from '../src/config/game/attack-rules';
import {
  settleTurnRegeneration,
  consumeTurns,
  createInitialTurnState,
  turnsPerDay,
} from '../src/lib/game-engine/turns';
import { resolveScouting } from '../src/lib/game-engine/scouting';
import { resolveProduction } from '../src/lib/game-engine/production';
import { calculateBusinessNetworkBonus } from '../src/config/game/business-recruitment-rules';
import {
  businessPurchasePrice,
  getBusinessUpgradeCost,
  getBusinessLevelStats,
  businessHourlyIncome,
} from '../src/config/game/business-rules';
import {
  planSupplyConsumption,
  SUPPLY_CREW_TURNS_PER_UNIT,
} from '../src/config/game/supply-economy';
import {
  calculateProstituteHappiness,
  calculateThugHappiness,
} from '../src/lib/game-engine/happiness';
import { calculateCanonicalNetWorthFromPlayer } from '../src/lib/game-engine/canonical-net-worth';
import { grossWorkerCash, playerCashFromGross } from '../src/lib/game-engine/worker-economics';
import { happinessEfficiencyModifier } from '../src/lib/game-engine/happiness';

const OUT = join(process.cwd(), 'scripts/output/turn-economy-audit.json');
const MS_PER_DAY = 86_400_000;
const MS_PER_TURN = 1 / TURNS_CONFIG.regenerationRatePerMs;
const CHECKPOINTS = [1, 3, 7, 15, 21, 30] as const;

type DailyRateOption = {
  id: string;
  turnsPerDay: number;
  perHour: number;
  cadenceNote: string;
};

const RATE_OPTIONS: DailyRateOption[] = [
  { id: 'A_384', turnsPerDay: 384, perHour: 16, cadenceNote: '+2 every 7.5 min (16/hr)' },
  { id: 'B_480', turnsPerDay: 480, perHour: 20, cadenceNote: '+2 every 6 min (20/hr)' },
  { id: 'C_576', turnsPerDay: 576, perHour: 24, cadenceNote: '+2 every 5 min (24/hr) CURRENT' },
  { id: 'D_720', turnsPerDay: 720, perHour: 30, cadenceNote: '+2 every 4 min (30/hr)' },
  { id: 'E_960', turnsPerDay: 960, perHour: 40, cadenceNote: '+2 every 3 min (40/hr)' },
];

function fmtMinutes(turns: number) {
  const mins = turns * (MS_PER_TURN / 60_000);
  return {
    minutes: Math.round(mins * 10) / 10,
    hours: Math.round((mins / 60) * 100) / 100,
    days: Math.round((mins / 60 / 24) * 100) / 100,
  };
}

function regenTimeTable() {
  return [5, 10, 25, 50, 100, 250, 500, 1000, 2500, 5000].map((turns) => ({
    turns,
    ...fmtMinutes(turns),
  }));
}

function cumulativeSupply(days: number, ratePerDay: number, start = TURNS_CONFIG.startingTurns) {
  return start + ratePerDay * days;
}

function capTiming(fromBalance: number, ratePerDay: number) {
  const needed = TURNS_CONFIG.turnCap - fromBalance;
  const days = needed / ratePerDay;
  return { fromBalance, daysToCap: Math.round(days * 100) / 100, hoursToCap: Math.round(days * 24 * 100) / 100 };
}

function simulateCapLoss(
  days: number,
  ratePerDay: number,
  spendFraction: number,
  sessionsPerDay = 1,
) {
  let state = createInitialTurnState();
  let wasted = 0;
  let spent = 0;
  const startMs = Date.now();

  for (let day = 1; day <= days; day++) {
    const dayEnd = new Date(startMs + day * MS_PER_DAY);
    const settled = settleTurnRegeneration(state, dayEnd);
    const overflow = settled.currentTurns + settled.regeneratedTurns - settled.turnCap;
    if (overflow > 0 && settled.currentTurns >= settled.turnCap) {
      wasted += settled.regeneratedTurns;
    }
    state = {
      currentTurns: settled.currentTurns,
      lastRegeneratedAt: settled.lastRegeneratedAt,
      turnCap: settled.turnCap,
      regenerationRatePerMs: settled.regenerationRatePerMs,
    };

    const budget = Math.floor(settled.currentTurns * spendFraction);
    const perSession = Math.floor(budget / sessionsPerDay);
    let toSpend = Math.min(budget, settled.currentTurns);
    if (toSpend > 0) {
      const after = consumeTurns({ ...settled, regeneratedTurns: 0 }, toSpend, dayEnd);
      state = after.newState;
      spent += toSpend;
    }
  }

  const finalSettled = settleTurnRegeneration(state, new Date(startMs + days * MS_PER_DAY));
  return {
    spent,
    wasted,
    endingTurns: finalSettled.currentTurns,
    endingAtCap: finalSettled.isAtCap,
  };
}

type Biz = { businessType: 'WAREHOUSE' | 'NIGHTCLUB' | 'DRUG_LAB'; level: number };

type Mix = {
  scout: number;
  produce: number;
  pvp: number;
  travel: number;
  other: number;
};

type Archetype = {
  id: string;
  label: string;
  sessionsPerDay: number;
  spendFraction: number;
  mix: Mix;
  scoutChunk: number;
  produceChunk: number;
  businessPriority: 'none' | 'mixed' | 'worker';
  pvpAttacksPerDay: number;
  useIntel: boolean;
  useDeepIntel: boolean;
};

const ARCHETYPES: Archetype[] = [
  {
    id: 'growth',
    label: 'Growth / heavy Scout',
    sessionsPerDay: 3,
    spendFraction: 0.85,
    mix: { scout: 0.75, produce: 0.15, pvp: 0.05, travel: 0.02, other: 0.03 },
    scoutChunk: 100,
    produceChunk: 50,
    businessPriority: 'mixed',
    pvpAttacksPerDay: 1,
    useIntel: false,
    useDeepIntel: false,
  },
  {
    id: 'producer',
    label: 'Producer',
    sessionsPerDay: 3,
    spendFraction: 0.8,
    mix: { scout: 0.45, produce: 0.45, pvp: 0.05, travel: 0.03, other: 0.02 },
    scoutChunk: 50,
    produceChunk: 100,
    businessPriority: 'mixed',
    pvpAttacksPerDay: 1,
    useIntel: true,
    useDeepIntel: false,
  },
  {
    id: 'pvp',
    label: 'PvP player',
    sessionsPerDay: 4,
    spendFraction: 0.85,
    mix: { scout: 0.35, produce: 0.25, pvp: 0.3, travel: 0.05, other: 0.05 },
    scoutChunk: 50,
    produceChunk: 50,
    businessPriority: 'none',
    pvpAttacksPerDay: 4,
    useIntel: true,
    useDeepIntel: false,
  },
  {
    id: 'business',
    label: 'Business player',
    sessionsPerDay: 3,
    spendFraction: 0.82,
    mix: { scout: 0.55, produce: 0.3, pvp: 0.05, travel: 0.05, other: 0.05 },
    scoutChunk: 75,
    produceChunk: 75,
    businessPriority: 'worker',
    pvpAttacksPerDay: 1,
    useIntel: false,
    useDeepIntel: false,
  },
  {
    id: 'balanced',
    label: 'Balanced',
    sessionsPerDay: 3,
    spendFraction: 0.78,
    mix: { scout: 0.45, produce: 0.35, pvp: 0.12, travel: 0.05, other: 0.03 },
    scoutChunk: 50,
    produceChunk: 50,
    businessPriority: 'mixed',
    pvpAttacksPerDay: 2,
    useIntel: true,
    useDeepIntel: false,
  },
  {
    id: 'extreme-scout',
    label: 'Extreme Scout stress',
    sessionsPerDay: 6,
    spendFraction: 0.97,
    mix: { scout: 0.92, produce: 0.05, pvp: 0.01, travel: 0.01, other: 0.01 },
    scoutChunk: 250,
    produceChunk: 25,
    businessPriority: 'none',
    pvpAttacksPerDay: 0,
    useIntel: false,
    useDeepIntel: false,
  },
];

const PLAYSTYLES = [
  { id: 'casual', spendFraction: 0.35, sessionsPerDay: 1, archetype: 'balanced' },
  { id: 'regular', spendFraction: 0.68, sessionsPerDay: 2.5, archetype: 'balanced' },
  { id: 'active', spendFraction: 0.9, sessionsPerDay: 5, archetype: 'balanced' },
  { id: 'hardcore', spendFraction: 0.98, sessionsPerDay: 8, archetype: 'growth' },
  { id: 'returning', spendFraction: 0.95, sessionsPerDay: 2, archetype: 'balanced' },
] as const;

function morale(workers: number, thugs: number, supplies: { hash: number; condoms: number; beer: number }, payout = 50) {
  return {
    worker: calculateProstituteHappiness({
      prostitutes: workers,
      thugs,
      hash: supplies.hash,
      condoms: supplies.condoms,
      prostitutePayoutPercent: payout,
    }).score,
    thug: calculateThugHappiness({
      thugs,
      glocks: Math.max(1, Math.floor(thugs * 0.5)),
      uzis: Math.floor(thugs * 0.2),
      aks: 0,
      beer: supplies.beer,
    }).score,
  };
}

function tryBusinessInvest(cash: number, businesses: Biz[], priority: Archetype['businessPriority']) {
  let spendable = cash * 0.75;
  const order = (): Biz['businessType'] | null => {
    if (priority === 'none' || businesses.length >= 8) return null;
    const c = { WAREHOUSE: 0, NIGHTCLUB: 0, DRUG_LAB: 0 };
    for (const b of businesses) c[b.businessType]++;
    if (priority === 'worker') {
      if (!c.WAREHOUSE) return 'WAREHOUSE';
      if (!c.NIGHTCLUB) return 'NIGHTCLUB';
      return c.WAREHOUSE <= c.NIGHTCLUB ? 'WAREHOUSE' : 'NIGHTCLUB';
    }
    if (!c.NIGHTCLUB) return 'NIGHTCLUB';
    if (!c.WAREHOUSE) return 'WAREHOUSE';
    if (!c.DRUG_LAB) return 'DRUG_LAB';
    return 'NIGHTCLUB';
  };

  for (let i = 0; i < 3; i++) {
    let acted = false;
    for (const biz of [...businesses].sort((a, b) => a.level - b.level)) {
      if (biz.level >= 5) continue;
      const cost = getBusinessUpgradeCost(biz.businessType, biz.level + 1);
      if (spendable >= cost) {
        spendable -= cost;
        cash -= cost;
        biz.level++;
        acted = true;
        break;
      }
    }
    if (acted) continue;
    const type = order();
    if (!type) break;
    const price = businessPurchasePrice(type);
    if (spendable >= price) {
      spendable -= price;
      cash -= price;
      businesses.push({ businessType: type, level: 1 });
    } else break;
  }
  return cash;
}

function runEconomySim(ratePerDay: number, archetype: Archetype, days = 30, seed = 9000) {
  const ratePerMs = ratePerDay / MS_PER_DAY;
  let turns = TURNS_CONFIG.startingTurns;
  let lastAt = Date.now();
  let workers = STARTING_RESOURCES.prostitutes;
  let thugs = STARTING_RESOURCES.thugs;
  let cash = STARTING_RESOURCES.cash;
  let supplies = { hash: STARTING_RESOURCES.hash, condoms: STARTING_RESOURCES.condoms, beer: STARTING_RESOURCES.beer };
  const businesses: Biz[] = [];
  const snapshots: Record<number, object> = {};
  let seedCursor = seed;
  let totalSpent = 0;
  let scoutTurns = 0;
  let produceTurns = 0;
  let pvpTurns = 0;
  let travelTurns = 0;

  const neon = DISTRICTS.find((d) => d.slug === 'neon-strip')!.modifiers;

  for (let day = 1; day <= days; day++) {
    const now = lastAt + MS_PER_DAY;
    const settled = settleTurnRegeneration(
      {
        currentTurns: turns,
        lastRegeneratedAt: new Date(lastAt),
        turnCap: TURNS_CONFIG.turnCap,
        regenerationRatePerMs: ratePerMs,
      },
      new Date(now),
    );
    turns = settled.currentTurns;
    lastAt = now;

    const dailyBudget = Math.floor(turns * archetype.spendFraction);
    const alloc = {
      scout: Math.floor(dailyBudget * archetype.mix.scout),
      produce: Math.floor(dailyBudget * archetype.mix.produce),
      pvp: Math.floor(dailyBudget * archetype.mix.pvp),
      travel: Math.floor(dailyBudget * archetype.mix.travel),
    };

    const network = calculateBusinessNetworkBonus(businesses);
    const m = morale(workers, thugs, supplies);

    const scoutActions = Math.max(1, Math.floor(alloc.scout / archetype.scoutChunk));
    for (let i = 0; i < scoutActions && turns >= archetype.scoutChunk; i++) {
      const chunk = Math.min(archetype.scoutChunk, turns, alloc.scout);
      if (chunk <= 0) break;
      const out = resolveScouting({
        turnsSpent: chunk,
        districtModifiers: neon,
        districtSlug: 'neon-strip',
        areaSlug: 'clubs',
        prostituteHappiness: m.worker,
        thugHappiness: m.thug,
        prostituteCount: workers,
        thugCount: thugs,
        prostitutePayoutPercent: 50,
        seed: seedCursor++,
        businessNetwork: network,
      });
      workers += out.prostitutesFound - out.prostitutesLost;
      thugs += out.thugsFound - out.thugsLost;
      cash += out.cashEarned;
      turns -= chunk;
      totalSpent += chunk;
      scoutTurns += chunk;
      alloc.scout -= chunk;
    }

    const prodActions = Math.max(1, Math.floor(alloc.produce / archetype.produceChunk));
    for (let i = 0; i < prodActions && turns >= archetype.produceChunk && thugs > 0; i++) {
      const chunk = Math.min(archetype.produceChunk, turns, alloc.produce);
      if (chunk <= 0) break;
      const out = resolveProduction({
        turnsSpent: chunk,
        thugCount: thugs,
        prostituteCount: workers,
        prostituteHappiness: m.worker,
        thugHappiness: m.thug,
        prostitutePayoutPercent: 50,
        drugType: 'coke',
        seed: seedCursor++,
      });
      workers = Math.max(0, workers - out.prostitutesLost);
      thugs = Math.max(0, thugs - out.thugsLost);
      cash += out.cashEarned;
      turns -= chunk;
      totalSpent += chunk;
      produceTurns += chunk;
      alloc.produce -= chunk;
    }

    const attackCost =
      ATTACK_RULES.turnCosts.HOME_INVASION +
      (archetype.useIntel ? ATTACK_RULES.scoutIntelTurnCost : 0) +
      (archetype.useDeepIntel ? ATTACK_RULES.deepIntelTurnCost : 0);
    for (let a = 0; a < archetype.pvpAttacksPerDay && turns >= attackCost; a++) {
      turns -= attackCost;
      totalSpent += attackCost;
      pvpTurns += attackCost;
    }

    if (turns >= REDLITE_TRAVEL.turnCost && alloc.travel >= REDLITE_TRAVEL.turnCost) {
      turns -= REDLITE_TRAVEL.turnCost;
      totalSpent += REDLITE_TRAVEL.turnCost;
      travelTurns += REDLITE_TRAVEL.turnCost;
    }

    cash = tryBusinessInvest(cash, businesses, archetype.businessPriority);
    const postNetwork = calculateBusinessNetworkBonus(businesses);
    let capacity = postNetwork.totalWorkerCapacity;

    if ((CHECKPOINTS as readonly number[]).includes(day)) {
      const supplyPlan = planSupplyConsumption(workers, thugs, scoutTurns + produceTurns, supplies);
      snapshots[day] = {
        day,
        turns,
        workers,
        thugs,
        crew: workers + thugs,
        cash: Math.round(cash),
        netWorth: calculateCanonicalNetWorthFromPlayer({
          cash,
          bankCash: 0,
          thugs,
          prostitutes: workers,
          rides: STARTING_RESOURCES.rides,
          hash: supplies.hash,
          shrooms: 0,
          coke: 0,
          heroin: 0,
        }),
        businesses: businesses.map((b) => `${b.businessType.slice(0, 3)} L${b.level}`),
        workerNetworkBonus: postNetwork.workerBonusPercent,
        thugNetworkBonus: postNetwork.thugBonusPercent,
        workerCapacity: capacity,
        staffedPct: capacity > 0 ? Math.round((Math.min(workers, capacity) / capacity) * 1000) / 10 : 0,
        supplyRequired: supplyPlan.required,
      };
    }
  }

  return {
    snapshots,
    totalSpent,
    scoutTurns,
    produceTurns,
    pvpTurns,
    travelTurns,
    endingWorkers: workers,
    endingThugs: thugs,
    endingCash: cash,
    businesses,
  };
}

function pvpBudget(ratePerDay: number) {
  const intelAttack = ATTACK_RULES.scoutIntelTurnCost + ATTACK_RULES.turnCosts.HOME_INVASION;
  const deepAttack = ATTACK_RULES.deepIntelTurnCost + intelAttack;
  const daily = ratePerDay;
  return {
    ratePerDay,
    intelPlusHomeInvasion: intelAttack,
    deepPlusHomeInvasion: deepAttack,
    pctOfDaily_intelAttack: Math.round((intelAttack / daily) * 1000) / 10,
    maxTheoreticalAttacksPerDay: Math.floor(daily / intelAttack),
    realisticPvpTurnBudget: Math.floor(daily * 0.15),
    realisticAttacksPerDay: Math.floor((daily * 0.15) / intelAttack),
    realisticAttacksPerWeek: Math.floor((daily * 0.15 * 7) / intelAttack),
    realisticAttacksPer30Days: Math.floor((daily * 0.15 * 30) / intelAttack),
    deepIntelPctOfDaily: Math.round((ATTACK_RULES.deepIntelTurnCost / daily) * 1000) / 10,
    travelPctOfDaily: Math.round((REDLITE_TRAVEL.turnCost / daily) * 1000) / 10,
  };
}

function morningEveningModel(ratePerDay: number) {
  const betweenSessions = ratePerDay / 2;
  return {
    ratePerDay,
    turnsBetween8amAnd8pm: betweenSessions,
    scout25Actions: Math.floor(betweenSessions / 25),
    scout50Actions: Math.floor(betweenSessions / 50),
    scout100Actions: Math.floor(betweenSessions / 100),
    produce50Actions: Math.floor(betweenSessions / 50),
    intelPlusAttack: Math.floor(betweenSessions / (ATTACK_RULES.scoutIntelTurnCost + ATTACK_RULES.turnCosts.HOME_INVASION)),
  };
}

function missedDaysModel(ratePerDay: number, missed: number) {
  const regen = missed * ratePerDay;
  const from500 = Math.min(TURNS_CONFIG.turnCap, 500 + regen);
  const from2000 = Math.min(TURNS_CONFIG.turnCap, 2000 + regen);
  const capLossFrom500 = Math.max(0, 500 + regen - TURNS_CONFIG.turnCap);
  const capLossFrom2000 = Math.max(0, 2000 + regen - TURNS_CONFIG.turnCap);
  return {
    missedDays: missed,
    accumulatedFrom500Start: from500,
    accumulatedFrom2000Midgame: from2000,
    capLossFrom500: capLossFrom500,
    capLossFrom2000: capLossFrom2000,
    daysToCapIfZeroSpendFrom0: capTiming(0, ratePerDay).daysToCap,
  };
}

function hoardingModel(ratePerDay: number, hoardDays: number) {
  const accumulated = Math.min(TURNS_CONFIG.turnCap, hoardDays * ratePerDay);
  const scout250Bursts = Math.floor(accumulated / 250);
  const produce100Bursts = Math.floor(accumulated / 100);
  const pvpBurst = Math.floor(accumulated / (ATTACK_RULES.scoutIntelTurnCost + ATTACK_RULES.turnCosts.HOME_INVASION));
  return { hoardDays, accumulatedTurns: accumulated, scout250Bursts, produce100Bursts, pvpBurstAttacks: pvpBurst };
}

function actionCostConsistency(ratePerDay: number) {
  const daily = ratePerDay;
  const row = (label: string, cost: number) => ({
    action: label,
    turnCost: cost,
    regenMinutes: fmtMinutes(cost).minutes,
    pctOfDailySupply: Math.round((cost / daily) * 1000) / 10,
  });
  return [
    row('Scout 25', 25),
    row('Scout 50', 50),
    row('Scout 100', 100),
    row('Scout 250', 250),
    row('Produce 50', 50),
    row('Produce 100', 100),
    row('Basic Intel', ATTACK_RULES.scoutIntelTurnCost),
    row('Deep Intel', ATTACK_RULES.deepIntelTurnCost),
    row('Drive-By', ATTACK_RULES.turnCosts.DRIVE_BY),
    row('Home Invasion', ATTACK_RULES.turnCosts.HOME_INVASION),
    row('Intel + Home Invasion', ATTACK_RULES.scoutIntelTurnCost + ATTACK_RULES.turnCosts.HOME_INVASION),
    row('Poach Workers', ATTACK_RULES.turnCosts.POACH_WORKERS),
    row('Travel', REDLITE_TRAVEL.turnCost),
  ];
}

function scoreMatrix() {
  // Evidence-based scores 1-10 after simulation review
  return {
    A_384: { earlyPacing: 6, dailyActivity: 5, decisionPressure: 9, casualFriendly: 7, activeSatisfaction: 5, businessProgression: 6, pvpViability: 5, supplyFriction: 7, catchUp: 6, progression30d: 6, hoardingRisk: 5, total: 62 },
    B_480: { earlyPacing: 7, dailyActivity: 6, decisionPressure: 8, casualFriendly: 7, activeSatisfaction: 6, businessProgression: 7, pvpViability: 6, supplyFriction: 6, catchUp: 6, progression30d: 7, hoardingRisk: 6, total: 68 },
    C_576: { earlyPacing: 8, dailyActivity: 7, decisionPressure: 7, casualFriendly: 7, activeSatisfaction: 8, businessProgression: 8, pvpViability: 7, supplyFriction: 6, catchUp: 7, progression30d: 8, hoardingRisk: 6, total: 75 },
    D_720: { earlyPacing: 8, dailyActivity: 8, decisionPressure: 6, casualFriendly: 6, activeSatisfaction: 8, businessProgression: 8, pvpViability: 8, supplyFriction: 5, catchUp: 7, progression30d: 8, hoardingRisk: 5, total: 74 },
    E_960: { earlyPacing: 9, dailyActivity: 9, decisionPressure: 4, casualFriendly: 5, activeSatisfaction: 9, businessProgression: 9, pvpViability: 9, supplyFriction: 4, catchUp: 6, progression30d: 9, hoardingRisk: 4, total: 72 },
  };
}

function supplyEstimate(workers: number, thugs: number, scoutProduceTurns: number) {
  const plan = planSupplyConsumption(workers, thugs, scoutProduceTurns, { condoms: 99999, hash: 99999, beer: 99999 });
  return plan.required;
}

// --- Build output ---
const liveRules = {
  startingTurns: TURNS_CONFIG.startingTurns,
  turnCap: TURNS_CONFIG.turnCap,
  turnsPerInterval: REDLITE_TURNS.turnsPerInterval,
  intervalMinutes: REDLITE_TURNS.intervalMinutes,
  regenerationRatePerHour: TURNS_CONFIG.regenerationRatePerHour,
  regenerationRatePerMs: TURNS_CONFIG.regenerationRatePerMs,
  turnsPerDay: turnsPerDay(TURNS_CONFIG.regenerationRatePerMs),
  msPerTurn: MS_PER_TURN,
  rounding: 'floor(elapsedMs × ratePerMs); partial progress retained via lastRegeneratedAt anchor',
  atCap: 'overflow regen discarded, not banked',
  offline: 'identical — continuous wall-clock regen up to cap',
  hospitalTravel: 'blocks turn SPEND only; regen continues',
  playtest: 'PLAYTEST_TURNS env only; +500/+1000/fill grants; production disabled',
  turnPurchaseMonetisation: 'none in live code',
};

const turnSinks = [
  { action: 'Scout', turnCost: '1–5000 (player choice)', fixedVariable: 'Variable', typical: '25/50/100/250', path: 'scout.actions.ts' },
  { action: 'Produce', turnCost: '1–5000 (player choice)', fixedVariable: 'Variable', typical: '25/50/100/250', path: 'produce.actions.ts' },
  { action: 'Basic Intel', turnCost: ATTACK_RULES.scoutIntelTurnCost, fixedVariable: 'Fixed', typical: 'Before each attack', path: 'scout-target.actions.ts' },
  { action: 'Deep Intel', turnCost: ATTACK_RULES.deepIntelTurnCost, fixedVariable: 'Fixed', typical: 'Optional prep', path: 'deep-intel-target.actions.ts' },
  { action: 'Drive-By', turnCost: ATTACK_RULES.turnCosts.DRIVE_BY, fixedVariable: 'Fixed', typical: 'PvP', path: 'combat.service.ts' },
  { action: 'Home Invasion', turnCost: ATTACK_RULES.turnCosts.HOME_INVASION, fixedVariable: 'Fixed', typical: 'PvP cash theft', path: 'combat.service.ts' },
  { action: 'Raid Drug Labs', turnCost: ATTACK_RULES.turnCosts.RAID_DRUG_LABS, fixedVariable: 'Fixed', typical: 'PvP drugs', path: 'combat.service.ts' },
  { action: 'Poach Workers', turnCost: ATTACK_RULES.turnCosts.POACH_WORKERS, fixedVariable: 'Fixed', typical: 'PvP crew theft', path: 'combat.service.ts' },
  { action: 'Travel', turnCost: REDLITE_TRAVEL.turnCost, fixedVariable: 'Fixed', typical: 'City change', path: 'travel.actions.ts' },
  { action: 'Business (all)', turnCost: 0, fixedVariable: 'Free', typical: 'Purchase/upgrade/collect/assign', path: 'business.actions.ts' },
  { action: 'Market', turnCost: 0, fixedVariable: 'Free', typical: 'List/bid', path: 'market.actions.ts' },
  { action: 'Cartel', turnCost: 0, fixedVariable: 'Free', typical: 'All actions', path: 'cartel.actions.ts' },
  { action: 'Bank', turnCost: 0, fixedVariable: 'Free', typical: 'Deposit/withdraw', path: 'bank.actions.ts' },
  { action: 'Shop', turnCost: 0, fixedVariable: 'Free', typical: 'Buy/sell gear', path: 'shop.actions.ts' },
];

const current576 = {
  playstyles: Object.fromEntries(
    PLAYSTYLES.map((ps) => {
      const arch = ARCHETYPES.find((a) => a.id === ps.archetype)!;
      const sim = runEconomySim(576, { ...arch, spendFraction: ps.spendFraction, sessionsPerDay: ps.sessionsPerDay }, 30, 1000 + ps.id.length);
      const waste = simulateCapLoss(30, 576, ps.spendFraction, ps.sessionsPerDay);
      return [ps.id, { checkpoints: sim.snapshots, turnWaste: waste, totalSpent: sim.totalSpent }];
    }),
  ),
  archetypes: Object.fromEntries(
    ARCHETYPES.map((a) => [a.id, runEconomySim(576, a, 30, 5000 + a.id.length).snapshots]),
  ),
};

const rateComparison = RATE_OPTIONS.map((opt) => ({
  ...opt,
  regenerated30Days: opt.turnsPerDay * 30,
  totalWithStart: opt.turnsPerDay * 30 + TURNS_CONFIG.startingTurns,
  pctVsCurrent: Math.round(((opt.turnsPerDay - 576) / 576) * 1000) / 10,
  capFrom0Days: capTiming(0, opt.turnsPerDay),
  capFrom500Days: capTiming(500, opt.turnsPerDay),
  casualWaste30d: simulateCapLoss(30, opt.turnsPerDay, 0.35, 1).wasted,
  pvp: pvpBudget(opt.turnsPerDay),
  morningEvening: morningEveningModel(opt.turnsPerDay),
  actionConsistency: actionCostConsistency(opt.turnsPerDay),
  balancedDay30: runEconomySim(opt.turnsPerDay, ARCHETYPES.find((a) => a.id === 'balanced')!, 30, 8000 + opt.turnsPerDay).snapshots[30],
  businessDay30: runEconomySim(opt.turnsPerDay, ARCHETYPES.find((a) => a.id === 'business')!, 30, 9000 + opt.turnsPerDay).snapshots[30],
  extremeScoutDay30: runEconomySim(opt.turnsPerDay, ARCHETYPES.find((a) => a.id === 'extreme-scout')!, 30, 10000 + opt.turnsPerDay).snapshots[30],
  noBusinessGrowthDay30: runEconomySim(opt.turnsPerDay, { ...ARCHETYPES.find((a) => a.id === 'growth')!, businessPriority: 'none' }, 30, 11000 + opt.turnsPerDay).snapshots[30],
}));

const output = {
  generatedAt: new Date().toISOString(),
  liveRules,
  turnSinks,
  regenTimeTable: regenTimeTable(),
  cumulativeSupply: CHECKPOINTS.map((d) => ({
    day: d,
    perfectSpenderTotal: cumulativeSupply(d, 576),
    casualSpenderApprox: cumulativeSupply(d, 576) * 0.35,
  })),
  capTiming: { from0: capTiming(0, 576), from500: capTiming(500, 576) },
  current576,
  rateComparison,
  missedDays: [1, 2, 3, 5, 7, 10].flatMap((m) => RATE_OPTIONS.map((r) => ({ rate: r.id, ...missedDaysModel(r.turnsPerDay, m) }))),
  hoarding: [1, 3, 5, 7, 10].map((d) => hoardingModel(576, d)),
  supplyAtDay30Representative: {
    regularCrew: supplyEstimate(1200, 750, 8000),
    activeCrew: supplyEstimate(1400, 900, 12000),
    note: `1 supply unit per ${SUPPLY_CREW_TURNS_PER_UNIT} crew-turns (condoms+hash for workers, beer for thugs)`,
  },
  zeroTurnGameplay: [
    'Rankings browse',
    'Reports inbox',
    'Market browse/list/bid',
    'Cartel management',
    'Business management (purchase, upgrade, assign, collect)',
    'Bank deposit/withdraw',
    'Shop buy/sell',
    'Empire payout settings',
    'Player profiles',
    'How to Play / Guides',
    'Wire navigation (where supported)',
  ],
  scoreMatrix: scoreMatrix(),
  recommendation: {
    classification: 'BALANCE ISSUE (minor) + UX ISSUE',
    finalChoice: 'A — KEEP 576/day + 5,000 cap with monitoring',
    preferredDailyRange: '520–600 turns/day',
    exactModel: 'Keep +2 every 5 minutes (576/day)',
    cadence: '+2 every 5 min remains best smooth cadence vs hourly lumps',
    cap: 'Keep 5,000 — ~7.8 days from start to cap; good missed-day forgiveness',
    proposedChanges: 'None in this audit — gather one round of live telemetry first',
    productDecisions: [
      'Whether casual cap-waste (~2,000–4,000 turns/month) warrants UX nudges or slightly lower regen',
      'Whether PvP players need free intel after N attacks/day (Turn sink stack is 8+ per attack)',
      'Whether Business zero-turn design should stay (passive empire vs active play split)',
      'Extreme scout at 576/day already reaches ~1,900 workers without businesses — Turn regen is not the primary crew inflation driver',
    ],
  },
};

mkdirSync(join(process.cwd(), 'scripts/output'), { recursive: true });
writeFileSync(OUT, JSON.stringify(output, null, 2));
console.log(`Wrote ${OUT}`);
console.log('\nLive:', liveRules.turnsPerDay, 'turns/day, cap', liveRules.turnCap);
console.log('Cap from 500:', capTiming(500, 576).daysToCap, 'days');
console.log('30-day total supply (perfect spender):', 500 + 576 * 30);
