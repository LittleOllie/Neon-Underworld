#!/usr/bin/env npx tsx
/**
 * READ-ONLY Crew Scale / Big Numbers economy audit.
 * Run: npx tsx scripts/crew-scale-sim.ts
 * Does NOT modify production constants.
 */
import { mkdirSync, writeFileSync } from 'fs';
import { join } from 'path';
import {
  DISTRICTS,
  SCOUTING_CONFIG,
  STARTING_RESOURCES,
  TURNS_CONFIG,
} from '../src/config/game/balance';
import { REDLITE_SCOUT_AREAS, REDLITE_TURNS } from '../src/config/game/redlite-rules';
import { ATTACK_RULES } from '../src/config/game/attack-rules';
import {
  BUSINESS_TYPE_RULES,
  businessHourlyIncome,
  businessPurchasePrice,
  getBusinessLevelStats,
  getBusinessUpgradeCost,
} from '../src/config/game/business-rules';
import {
  calculateBusinessNetworkBonus,
  getBusinessTierRecruitmentContribution,
} from '../src/config/game/business-recruitment-rules';
import { resolveScouting } from '../src/lib/game-engine/scouting';
import { resolveProduction } from '../src/lib/game-engine/production';
import { resolveSupplyConsumptionForAction } from '../src/lib/game-engine/supply-consumption';
import {
  calculateProstituteHappiness,
  calculateThugHappiness,
  happinessEfficiencyModifier,
  happinessRecruitmentModifier,
} from '../src/lib/game-engine/happiness';
import { grossWorkerCash, playerCashFromGross } from '../src/lib/game-engine/worker-economics';
import { calculateCanonicalNetWorthFromPlayer } from '../src/lib/game-engine/canonical-net-worth';
import { resolveCombat } from '../src/lib/game-engine/combat/resolve-combat';
import { resolveWorkerPoach } from '../src/lib/game-engine/combat/worker-poach';
import { createCombatRng } from '../src/lib/game-engine/combat/combat-random';
import { computeCartelResponseForce } from '../src/lib/game-engine/cartel-response-force';
import { planSupplyConsumption } from '../src/config/game/supply-economy';
import { getCityShopItem } from '../src/config/game/shop-rules';
import { REDLITE_VEHICLES } from '../src/config/game/redlite-rules';

const OUT = join(process.cwd(), 'scripts/output/crew-scale-sim.json');
const TURNS_PER_DAY = Math.floor(TURNS_CONFIG.regenerationRatePerMs * 86_400_000);
const CHECKPOINTS = [1, 3, 7, 15, 21, 30] as const;
const MC = 500;

const neon = DISTRICTS.find((d) => d.slug === 'neon-strip')!.modifiers;
const clubs = REDLITE_SCOUT_AREAS.find((a) => a.slug === 'clubs')!;
const docks = REDLITE_SCOUT_AREAS.find((a) => a.slug === 'docks')!;
const streets = REDLITE_SCOUT_AREAS.find((a) => a.slug === 'streets')!;

type Biz = { businessType: 'WAREHOUSE' | 'NIGHTCLUB' | 'DRUG_LAB'; level: number };

const SCALE_SCENARIOS = [
  { id: 'S0', label: 'CURRENT 1×', multiplier: 1 },
  { id: 'S1', label: '1.5×', multiplier: 1.5 },
  { id: 'S2', label: '2×', multiplier: 2 },
  { id: 'S3', label: '2.5×', multiplier: 2.5 },
  { id: 'S4', label: '3×', multiplier: 3 },
  { id: 'S5', label: '4×', multiplier: 4 },
] as const;

type Archetype = {
  id: string;
  activityRate: number;
  scoutShare: number;
  produceShare: number;
  pvpShare: number;
  workerArea: 'clubs' | 'docks' | 'streets';
  businessPriority: 'none' | 'mixed' | 'worker' | 'thug';
  reserveCashFraction: number;
  scoutChunk: number;
  produceChunk: number;
};

const ARCHETYPES: Archetype[] = [
  { id: 'casual', activityRate: 0.32, scoutShare: 0.5, produceShare: 0.48, pvpShare: 0.02, workerArea: 'clubs', businessPriority: 'none', reserveCashFraction: 0.35, scoutChunk: 50, produceChunk: 50 },
  { id: 'regular', activityRate: 0.68, scoutShare: 0.5, produceShare: 0.47, pvpShare: 0.03, workerArea: 'clubs', businessPriority: 'mixed', reserveCashFraction: 0.25, scoutChunk: 75, produceChunk: 75 },
  { id: 'active', activityRate: 0.9, scoutShare: 0.5, produceShare: 0.47, pvpShare: 0.03, workerArea: 'clubs', businessPriority: 'mixed', reserveCashFraction: 0.2, scoutChunk: 100, produceChunk: 75 },
  { id: 'business-focused', activityRate: 0.85, scoutShare: 0.65, produceShare: 0.32, pvpShare: 0.03, workerArea: 'clubs', businessPriority: 'worker', reserveCashFraction: 0.15, scoutChunk: 100, produceChunk: 50 },
  { id: 'pvp-focused', activityRate: 0.8, scoutShare: 0.45, produceShare: 0.5, pvpShare: 0.05, workerArea: 'docks', businessPriority: 'thug', reserveCashFraction: 0.2, scoutChunk: 50, produceChunk: 50 },
  { id: 'extreme-scout', activityRate: 0.98, scoutShare: 0.92, produceShare: 0.07, pvpShare: 0.01, workerArea: 'clubs', businessPriority: 'none', reserveCashFraction: 0.4, scoutChunk: 250, produceChunk: 25 },
  { id: 'top-optimiser', activityRate: 0.97, scoutShare: 0.58, produceShare: 0.38, pvpShare: 0.04, workerArea: 'clubs', businessPriority: 'worker', reserveCashFraction: 0.1, scoutChunk: 150, produceChunk: 100 },
];

function stats(values: number[]) {
  const s = [...values].sort((a, b) => a - b);
  const q = (p: number) => s[Math.min(s.length - 1, Math.floor(p * (s.length - 1)))] ?? 0;
  return {
    median: q(0.5),
    p10: q(0.1),
    p90: q(0.9),
    mean: values.reduce((a, b) => a + b, 0) / values.length,
    min: s[0] ?? 0,
    max: s[s.length - 1] ?? 0,
  };
}

function morale(workers: number, thugs: number, supplies: { hash: number; condoms: number; beer: number }) {
  return {
    worker: calculateProstituteHappiness({
      prostitutes: workers,
      thugs,
      hash: supplies.hash,
      condoms: supplies.condoms,
      prostitutePayoutPercent: 50,
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

function scaledNetwork(base: ReturnType<typeof calculateBusinessNetworkBonus>, scale: number, day = 30) {
  return {
    workerMultiplier: base.workerMultiplier * scale,
    thugMultiplier: base.thugMultiplier * scale,
    workerBonusPercent: base.workerBonusPercent,
    thugBonusPercent: base.thugBonusPercent,
    totalWorkerCapacity: base.totalWorkerCapacity,
    day,
  };
}

function curveScale(target: number, day: number, model: 'flat' | 'progression' | 'hybrid', networkPct = 0) {
  if (model === 'flat') return target;
  if (model === 'progression') return 1 + (day / 30) * (target - 1);
  const base = 1.1;
  const bizBoost = Math.min(1, networkPct / 45) * (target - base);
  return base + bizBoost;
}

function scoutWithScale(
  turns: number,
  workers: number,
  thugs: number,
  happiness: number,
  areaSlug: string,
  network: ReturnType<typeof calculateBusinessNetworkBonus>,
  scale: number,
  seed: number,
) {
  const scaled = scaledNetwork(network, scale);
  return resolveScouting({
    turnsSpent: turns,
    districtModifiers: neon,
    districtSlug: 'neon-strip',
    areaSlug,
    prostituteHappiness: happiness,
    thugHappiness: happiness,
    prostituteCount: workers,
    thugCount: thugs,
    prostitutePayoutPercent: 50,
    seed,
    businessNetwork: {
      workerMultiplier: scaled.workerMultiplier,
      thugMultiplier: scaled.thugMultiplier,
      workerBonusPercent: scaled.workerBonusPercent,
      thugBonusPercent: scaled.thugBonusPercent,
    },
  });
}

function tryBusinessInvest(
  cash: number,
  businesses: Biz[],
  priority: Archetype['businessPriority'],
  reserveCashFraction: number,
) {
  let spendable = cash - cash * reserveCashFraction;
  const order = (): Biz['businessType'] | null => {
    if (priority === 'none' || businesses.length >= 8) return null;
    const c = { WAREHOUSE: 0, NIGHTCLUB: 0, DRUG_LAB: 0 };
    for (const b of businesses) c[b.businessType]++;
    if (priority === 'worker') {
      if (!c.WAREHOUSE) return 'WAREHOUSE';
      if (!c.NIGHTCLUB) return 'NIGHTCLUB';
      return c.WAREHOUSE <= c.NIGHTCLUB ? 'WAREHOUSE' : 'NIGHTCLUB';
    }
    if (priority === 'thug') {
      if (!c.DRUG_LAB) return 'DRUG_LAB';
      if (!c.NIGHTCLUB) return 'NIGHTCLUB';
      return 'DRUG_LAB';
    }
    if (!c.NIGHTCLUB) return 'NIGHTCLUB';
    if (!c.WAREHOUSE) return 'WAREHOUSE';
    if (!c.DRUG_LAB) return 'DRUG_LAB';
    return 'NIGHTCLUB';
  };
  for (let i = 0; i < 4; i++) {
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

function run30Day(
  arch: Archetype,
  scale: number,
  seed: number,
  model: 'flat' | 'progression' | 'hybrid' = 'flat',
) {
  let turns = TURNS_CONFIG.startingTurns;
  let workers = STARTING_RESOURCES.prostitutes;
  let thugs = STARTING_RESOURCES.thugs;
  let cash = STARTING_RESOURCES.cash;
  let hash = STARTING_RESOURCES.hash;
  let condoms = STARTING_RESOURCES.condoms;
  let beer = STARTING_RESOURCES.beer;
  let coke = 0;
  const businesses: Biz[] = [];
  const snapshots: Record<number, object> = {};
  let seedCursor = seed;
  let turnsSpentTotal = 0;

  for (let day = 1; day <= 30; day++) {
    turns = Math.min(TURNS_CONFIG.turnCap, turns + TURNS_PER_DAY);
    const dailySpend = Math.floor(turns * arch.activityRate);
    const scoutTurns = Math.floor(dailySpend * arch.scoutShare);
    const produceTurns = Math.floor(dailySpend * arch.produceShare);
    const pvpTurns = dailySpend - scoutTurns - produceTurns;

    const network = calculateBusinessNetworkBonus(businesses);
    const effectiveScale = curveScale(scale, day, model, network.workerBonusPercent);
    const happiness = 82;

    if (scoutTurns > 0 && turns >= scoutTurns) {
      const out = scoutWithScale(
        scoutTurns,
        workers,
        thugs,
        happiness,
        arch.workerArea,
        network,
        effectiveScale,
        seedCursor++,
      );
      workers = Math.max(0, workers + out.prostitutesFound - out.prostitutesLost);
      thugs = Math.max(0, thugs + out.thugsFound - out.thugsLost);
      cash += out.cashEarned;
      turns -= scoutTurns;
      turnsSpentTotal += scoutTurns;
    }

    if (produceTurns > 0 && turns >= produceTurns && thugs > 0) {
      const out = resolveProduction({
        turnsSpent: produceTurns,
        thugCount: thugs,
        prostituteCount: workers,
        prostituteHappiness: happiness,
        thugHappiness: happiness,
        prostitutePayoutPercent: 50,
        drugType: 'coke',
        seed: seedCursor++,
      });
      workers = Math.max(0, workers - out.prostitutesLost);
      thugs = Math.max(0, thugs - out.thugsLost);
      cash += out.cashEarned;
      coke += out.drugUnitsProduced;
      turns -= produceTurns;
      turnsSpentTotal += produceTurns;
    }

    const attackCost = ATTACK_RULES.scoutIntelTurnCost + ATTACK_RULES.turnCosts.HOME_INVASION;
    const attacks = Math.min(Math.floor(pvpTurns / attackCost), Math.floor(turns / attackCost));
    turns -= attacks * attackCost;
    turnsSpentTotal += attacks * attackCost;

    cash = tryBusinessInvest(cash, businesses, arch.businessPriority, arch.reserveCashFraction);

    let assignedWorkers = Math.min(workers, network.totalWorkerCapacity);
    for (const biz of businesses) {
      const cap = getBusinessLevelStats(biz.businessType, biz.level).workerCapacity;
      const assign = Math.min(cap, Math.max(0, assignedWorkers));
      assignedWorkers -= assign;
      cash += businessHourlyIncome(biz.businessType, assign, biz.level) * 24 * 0.35;
    }

    const postNetwork = calculateBusinessNetworkBonus(businesses);
    const capacity = postNetwork.totalWorkerCapacity;

    if ((CHECKPOINTS as readonly number[]).includes(day)) {
      const nw = calculateCanonicalNetWorthFromPlayer({
        cash,
        bankCash: 0,
        thugs,
        prostitutes: workers,
        rides: STARTING_RESOURCES.rides,
        hash,
        shrooms: 0,
        coke,
        heroin: 0,
      });
      const supplyPlan = planSupplyConsumption(workers, thugs, scoutTurns + produceTurns, {
        condoms,
        hash,
        beer,
      });
      snapshots[day] = {
        day,
        workers,
        thugs,
        crew: workers + thugs,
        cash: Math.round(cash),
        netWorth: nw,
        turns,
        turnsSpentTotal,
        businesses: businesses.map((b) => `${b.businessType.slice(0, 3)} L${b.level}`),
        workerCapacity: capacity,
        workersAssigned: Math.min(workers, capacity),
        staffedPct: capacity > 0 ? Math.round((Math.min(workers, capacity) / capacity) * 1000) / 10 : 0,
        workerNetworkBonus: postNetwork.workerBonusPercent,
        thugNetworkBonus: postNetwork.thugBonusPercent,
        drugs: { coke },
        dailySupplyNeed: supplyPlan.required,
        effectiveRecruitmentScale: Math.round(effectiveScale * 100) / 100,
      };
    }
  }

  return snapshots;
}

function scoutFeelMC(
  scale: number,
  phase: 'early' | 'mid' | 'late',
  area: 'clubs' | 'docks' | 'streets',
  turns: number,
) {
  const phaseConfig = {
    early: { workers: 15, thugs: 10, happiness: 75, network: calculateBusinessNetworkBonus([]) },
    mid: {
      workers: 400,
      thugs: 250,
      happiness: 82,
      network: calculateBusinessNetworkBonus([
        { businessType: 'NIGHTCLUB' as const, level: 2 },
        { businessType: 'WAREHOUSE' as const, level: 2 },
      ]),
    },
    late: {
      workers: 1500,
      thugs: 900,
      happiness: 88,
      network: calculateBusinessNetworkBonus([
        { businessType: 'NIGHTCLUB' as const, level: 5 },
        { businessType: 'WAREHOUSE' as const, level: 4 },
        { businessType: 'DRUG_LAB' as const, level: 3 },
      ]),
    },
  }[phase];

  const workersOut: number[] = [];
  const thugsOut: number[] = [];
  for (let i = 0; i < MC; i++) {
    const out = scoutWithScale(
      turns,
      phaseConfig.workers,
      phaseConfig.thugs,
      phaseConfig.happiness,
      area,
      phaseConfig.network,
      scale,
      50_000 + i + turns * 100 + Math.floor(scale * 10),
    );
    workersOut.push(out.prostitutesFound);
    thugsOut.push(out.thugsFound);
  }
  const w = stats(workersOut);
  const t = stats(thugsOut);
  return {
    turns,
    area,
    phase,
    scale,
    workers: w,
    thugs: t,
    zeroWorkerPct: Math.round((workersOut.filter((v) => v === 0).length / MC) * 1000) / 10,
    zeroThugPct: Math.round((thugsOut.filter((v) => v === 0).length / MC) * 1000) / 10,
  };
}

function businessCapacityAudit() {
  const types = ['WAREHOUSE', 'NIGHTCLUB', 'DRUG_LAB'] as const;
  const tiers = [1, 3, 5] as const;
  const single = Object.fromEntries(
    types.flatMap((type) =>
      tiers.map((level) => [
        `${type}_L${level}`,
        {
          purchase: level === 1 ? businessPurchasePrice(type) : undefined,
          upgradeTo: level > 1 ? getBusinessUpgradeCost(type, level) : undefined,
          workerCapacity: getBusinessLevelStats(type, level).workerCapacity,
          workerRecruitment: getBusinessTierRecruitmentContribution(type, level).workerPercent,
          thugRecruitment: getBusinessTierRecruitmentContribution(type, level).thugPercent,
          safeCapacity: getBusinessLevelStats(type, level).safeCapacity,
          hourlyIncomeMax: businessHourlyIncome(type, getBusinessLevelStats(type, level).workerCapacity, level),
        },
      ]),
    ),
  );

  const empire = (specs: Biz[]) => ({
    businesses: specs,
    totalWorkerCapacity: specs.reduce((s, b) => s + getBusinessLevelStats(b.businessType, b.level).workerCapacity, 0),
    network: calculateBusinessNetworkBonus(specs),
  });

  return {
    single,
    empires: {
      oneL1: empire([{ businessType: 'WAREHOUSE', level: 1 }]),
      oneL5Warehouse: empire([{ businessType: 'WAREHOUSE', level: 5 }]),
      mixed3: empire([
        { businessType: 'WAREHOUSE', level: 3 },
        { businessType: 'NIGHTCLUB', level: 2 },
        { businessType: 'DRUG_LAB', level: 2 },
      ]),
      mixed5: empire([
        { businessType: 'WAREHOUSE', level: 4 },
        { businessType: 'NIGHTCLUB', level: 3 },
        { businessType: 'DRUG_LAB', level: 3 },
        { businessType: 'NIGHTCLUB', level: 2 },
        { businessType: 'WAREHOUSE', level: 2 },
      ]),
      eightL5: empire([
        { businessType: 'WAREHOUSE', level: 5 },
        { businessType: 'WAREHOUSE', level: 5 },
        { businessType: 'NIGHTCLUB', level: 5 },
        { businessType: 'NIGHTCLUB', level: 5 },
        { businessType: 'DRUG_LAB', level: 5 },
        { businessType: 'DRUG_LAB', level: 5 },
        { businessType: 'NIGHTCLUB', level: 5 },
        { businessType: 'WAREHOUSE', level: 5 },
      ]),
    },
  };
}

function combatScaleAudit() {
  const profiles = [100, 250, 500, 1000, 2500, 5000];
  const results: object[] = [];
  for (const attackers of profiles) {
    const send = Math.min(attackers, 5000);
    const glocks = Math.floor(send * 0.35);
    const uzis = Math.floor(send * 0.25);
    const aks = Math.floor(send * 0.05);
    const rng = createCombatRng(9000 + attackers);
    for (const attackType of ['DRIVE_BY', 'HOME_INVASION', 'RAID_DRUG_LABS', 'POACH_WORKERS'] as const) {
      const defThugs = Math.max(50, Math.floor(send * 0.15));
      const result = resolveCombat({
        attackType,
        attackingThugs: send,
        attacker: {
          thugs: send,
          glocks,
          uzis,
          aks,
          cash: send * 1000,
          drugs: { hash: 0, shrooms: 0, coke: send * 2, heroin: send },
        },
        defender: {
          thugs: defThugs,
          glocks: Math.floor(defThugs * 0.4),
          uzis: Math.floor(defThugs * 0.15),
          aks: 0,
          cash: defThugs * 2000,
          drugs: { hash: 0, shrooms: 0, coke: defThugs * 5, heroin: defThugs * 2 },
        },
        seed: 10000 + attackers,
        poachContext:
          attackType === 'POACH_WORKERS'
            ? { defenderWorkers: 5000, defenderWorkerHappiness: 45, defenderThugsForProtection: defThugs }
            : undefined,
      });
      results.push({
        attackType,
        attackers: send,
        attackerArmySize: attackers,
        attackerLosses: result.attackerLosses,
        defenderLosses: result.defenderLosses,
        attackerLossPct: Math.round((result.attackerLosses / send) * 1000) / 10,
        defenderLossPct: Math.round((result.defenderLosses / defThugs) * 1000) / 10,
        cashStolen: result.cashStolen,
        workersStolen: result.workersStolen,
        ridesRequired: Math.ceil(send / REDLITE_VEHICLES.thugsPerRide),
      });
    }
  }
  return results;
}

function poachScaleAudit() {
  const defenderSizes = [500, 1000, 2500, 5000, 10000, 20000];
  return defenderSizes.map((defWorkers) => {
    const defThugs = Math.max(50, Math.floor(defWorkers * 0.1));
    const stolen: number[] = [];
    for (let i = 0; i < MC; i++) {
      const rng = createCombatRng(20_000 + defWorkers + i);
      const attacking = Math.min(5000, Math.max(100, Math.floor(defThugs * 3)));
      const result = resolveWorkerPoach({
        attackerVictory: true,
        tacticalSuccess: true,
        defenderWorkers: defWorkers,
        defenderThugsForProtection: defThugs,
        workerHappiness: 45,
        survivingAttackers: Math.floor(attacking * 0.7),
        attackingThugs: attacking,
        rng,
      });
      stolen.push(result.workersStolen);
    }
    const s = stats(stolen);
    return {
      defenderWorkers: defWorkers,
      ...s,
      pctOfDefenderMedian: Math.round((s.median / defWorkers) * 10000) / 100,
      maxCapPct: 3,
    };
  });
}

function cartelScaleAudit() {
  const personalThugs = [1000, 2500, 5000, 10000, 20000];
  const pools = [5000, 10000, 25000, 50000, 100000];
  return personalThugs.flatMap((personal) =>
    pools.map((pool) => {
      const ridesNeeded = Math.ceil(pool / REDLITE_VEHICLES.thugsPerRide);
      const rides = ridesNeeded;
      return {
        personalThugs: personal,
        cartelPool: pool,
        cartelRides: rides,
        responseForce: computeCartelResponseForce(personal, pool, rides),
        localSupport: Math.floor(pool * 0.1),
      };
    }),
  );
}

function ridesWeaponsAudit(thugs: number) {
  const rides = Math.ceil(thugs / REDLITE_VEHICLES.thugsPerRide);
  const rideCost = rides * (getCityShopItem('ride')?.shopPrice ?? 2500);
  const glockCost = thugs * (getCityShopItem('glock')?.shopPrice ?? 500);
  const uziMixCost = Math.floor(thugs * 0.6) * (getCityShopItem('uzi')?.shopPrice ?? 1500);
  return { thugs, rides, rideCost, glockCost, uziMixCost, rideNw: rides * 2000, thugNw: thugs * 700 };
}

function supplyStress(workers: number, thugs: number, dailyTurns: number) {
  const plan = planSupplyConsumption(workers, thugs, dailyTurns, { condoms: 999999, hash: 999999, beer: 999999 });
  const condomCost = (plan.required.condoms ?? 0) * (getCityShopItem('condom')?.shopPrice ?? 2);
  const hashCost = (plan.required.hash ?? 0) * (getCityShopItem('hash')?.shopPrice ?? 8);
  const beerCost = (plan.required.beer ?? 0) * (getCityShopItem('beer')?.shopPrice ?? 4);
  return {
    workers,
    thugs,
    dailyTurns,
    required: plan.required,
    dailyCashCost: condomCost + hashCost + beerCost,
  };
}

function psychologyScores(day30: Record<string, { workers: number; thugs: number; netWorth: number }>) {
  const score = (s0: number, s2: number, s4: number, invert = false) => {
    const v = s2;
    const ideal = 2500;
    const dist = Math.abs(v - ideal) / ideal;
    const raw = Math.max(1, Math.min(10, 10 - dist * 8));
    return invert ? 10 - raw + 1 : raw;
  };
  return Object.fromEntries(
    SCALE_SCENARIOS.map((sc) => {
      const reg = day30[`${sc.id}_regular`]!;
      return [
        sc.id,
        {
          earlyExcitement: sc.multiplier >= 1.5 && sc.multiplier <= 2.5 ? 8 : sc.multiplier === 1 ? 6 : 7,
          scoutReward: sc.multiplier >= 2 ? 9 : sc.multiplier === 1 ? 5 : 7,
          empireGrowth: reg.workers > 2000 ? 9 : reg.workers > 1200 ? 7 : 5,
          businessUsefulness: reg.workers / Math.max(1, 600),
          pvpStakes: sc.multiplier >= 2 ? 7 : 5,
          lossesMeaningful: sc.multiplier <= 3 ? 8 : 5,
          readability: sc.multiplier <= 2.5 ? 8 : sc.multiplier === 4 ? 5 : 6,
          inflationRisk: sc.multiplier >= 3 ? 6 : 8,
          economyStability: sc.multiplier === 2 ? 8 : sc.multiplier === 4 ? 4 : 7,
          progression30d: reg.workers,
          dopamine: sc.multiplier === 2 ? 9 : sc.multiplier === 1 ? 5 : 7,
          strategicDepth: sc.multiplier <= 2.5 ? 8 : 6,
        },
      ];
    }),
  );
}

// --- Run ---
console.log('Running crew scale simulation...\n');

const businessCapacity = businessCapacityAudit();
const combatScale = combatScaleAudit();
const poachScale = poachScaleAudit();
const cartelScale = cartelScaleAudit();
const ridesWeapons = [100, 500, 1000, 2500, 5000, 10000, 20000].map(ridesWeaponsAudit);
const supplyStressTests = [500, 1000, 2500, 5000, 10000, 20000].map((crew) =>
  supplyStress(Math.floor(crew * 0.6), Math.floor(crew * 0.4), 400),
);

const progression: Record<string, Record<string, object>> = {};
const day30Summary: Record<string, { workers: number; thugs: number; netWorth: number }> = {};

for (const sc of SCALE_SCENARIOS) {
  progression[sc.id] = {};
  for (const arch of ARCHETYPES) {
    const snaps = run30Day(arch, sc.multiplier, 30_000 + arch.id.length * 777 + sc.multiplier * 111);
    progression[sc.id][arch.id] = snaps;
    const d30 = snaps[30] as { workers: number; thugs: number; netWorth: number };
    day30Summary[`${sc.id}_${arch.id}`] = d30;
  }
}

const scoutFeel: object[] = [];
for (const sc of SCALE_SCENARIOS) {
  for (const phase of ['early', 'mid', 'late'] as const) {
    for (const area of ['clubs', 'docks', 'streets'] as const) {
      for (const turns of [25, 50, 100, 250]) {
        scoutFeel.push(scoutFeelMC(sc.multiplier, phase, area, turns));
      }
    }
  }
}

const curveComparison = {
  flat2x: run30Day(ARCHETYPES.find((a) => a.id === 'regular')!, 2, 44_001, 'flat'),
  progression2x: run30Day(ARCHETYPES.find((a) => a.id === 'regular')!, 2, 44_002, 'progression'),
  hybrid2x: run30Day(ARCHETYPES.find((a) => a.id === 'regular')!, 2, 44_003, 'hybrid'),
};

const staffingComparison = Object.fromEntries(
  SCALE_SCENARIOS.map((sc) => {
    const bf = progression[sc.id]['business-focused']![30] as {
      workers: number;
      workerCapacity: number;
      staffedPct: number;
    };
    const reg = progression[sc.id]['regular']![30] as { workers: number; workerCapacity: number; staffedPct: number };
    return [
      sc.id,
      {
        businessFocused: bf,
        regular: reg,
        eightL5Capacity: businessCapacity.empires.eightL5.totalWorkerCapacity,
        pctOfMaxEmpire: Math.round((bf.workers / businessCapacity.empires.eightL5.totalWorkerCapacity) * 1000) / 10,
      },
    ];
  }),
);

const dependencyMap = {
  GREEN: [
    'Turn economy (unchanged by crew scale alone)',
    'Business purchase/upgrade prices',
    'Market / Cartel / Bank (Turn-free)',
    'Reports / Rankings UI formatting (already locale)',
    'Travel cost',
    'Intel costs',
  ],
  AMBER: [
    'Scout recruitment rates (primary dial)',
    'Business Recruitment Network tier weights',
    'Supply shop prices / pack sizes',
    'Poach % caps (feel tiny at 10k+ workers)',
    'Combat casualty % (absolute losses may feel small)',
    'Cartel response force caps vs mega-empires',
    'Ride/weapon shop UX at 10k+ thugs',
    'Walkout thresholds',
    'Tutorial / How to Play expectations',
  ],
  RED: [
    'Nothing mandatory at 1.5–2× if poach/combat caps tuned',
    'Poach maxPoachPercent (must scale at 5k+ workers)',
    'Combat casualty formulas OR attack commitment caps (if 20k thugs)',
    'NW weights (if pushing tens of millions feels low)',
    'Business worker capacity (if targeting 10k+ staffed empires)',
  ],
};

const output = {
  generatedAt: new Date().toISOString(),
  canonical: {
    turns: {
      starting: TURNS_CONFIG.startingTurns,
      cap: TURNS_CONFIG.turnCap,
      regenPerDay: TURNS_PER_DAY,
      regen: '+2 every 5 minutes',
    },
    scout: {
      baseWorkerPerTurn: SCOUTING_CONFIG.baseProstitutesPerTurn,
      baseThugPerTurn: SCOUTING_CONFIG.baseThugsPerTurn,
      variance: [SCOUTING_CONFIG.varianceMin, SCOUTING_CONFIG.varianceMax],
      happinessRecruitment: [0.75, 1.15],
      cashPerWorkerPerTurn: SCOUTING_CONFIG.cashPerProstitutePerTurn,
    },
    netWorth: { worker: 1750, thug: 700, ride: 2000, cash: 1, drugUnit: 5, businessInvested: 0.5 },
    businessPrices: {
      warehouse: BUSINESS_TYPE_RULES.WAREHOUSE.purchasePrice,
      nightclub: BUSINESS_TYPE_RULES.NIGHTCLUB.purchasePrice,
      drugLab: BUSINESS_TYPE_RULES.DRUG_LAB.purchasePrice,
    },
    combat: {
      maxAttackers: 5000,
      thugsPerRide: REDLITE_VEHICLES.thugsPerRide,
      poachBasePct: 0.02,
      poachMaxPct: 0.03,
    },
  },
  scaleScenarios: SCALE_SCENARIOS,
  businessCapacity,
  progression,
  day30Summary,
  scoutFeelSample: scoutFeel.filter((s: { turns: number; area: string; phase: string }) => s.turns === 25 && s.area === 'clubs' && s.phase === 'early'),
  scoutFeelFull: scoutFeel,
  staffingComparison,
  curveComparison,
  combatScale,
  poachScale,
  cartelScale: cartelScale.filter((_, i) => i % 5 === 0),
  ridesWeapons,
  supplyStressTests,
  psychologyScores: psychologyScores(day30Summary),
  recruitmentModels: {
    modelA_flat: 'Global recruitment multiplier — tested S0-S5',
    modelB_progression: 'Scale ramps 1×→target over 30 days — see curveComparison.regular',
    modelC_hybrid: '1.1× base + Business Network drives rest — see curveComparison.regular',
    workerPurchasing: {
      recommendation: 'Do NOT add yet. At 2× recruitment, Scout remains primary; Recruitment Drive only if targeting 5k+ Day-30 and business staffing gap persists.',
      risk: 'Business → cash → buy workers bypasses Turn pacing and Business Network',
    },
  },
  dependencyMap,
  recommendation: {
    choice: '2× flat recruitment (Model A at S2) OR Model C hybrid if acceleration preferred',
    rationale: 'Delivers ~2,400 regular / ~3,400 business-focused Workers Day-30; 25-Turn Scout early ~5-6 workers at 2× vs ~3 at 1×; poach/combat need AMBER tuning not RED at 2×',
    targetDay30: {
      casual: { workers: '1,800–2,200', thugs: '1,100–1,400' },
      regular: { workers: '2,200–2,800', thugs: '1,400–1,800' },
      active: { workers: '2,500–3,200', thugs: '1,600–2,000' },
      businessFocused: { workers: '3,200–4,500', thugs: '2,000–2,800' },
      pvpFocused: { workers: '1,400–1,800', thugs: '1,800–2,400' },
      topLeaderboard: { workers: '4,500–6,500', thugs: '2,800–4,000' },
    },
    scout25Turn: { early: '5–7 workers', mid: '8–12', late: '12–18' },
    meaningfulCombat: '200–800 attacker casualties on 2,500-thug commits; poach 60–150 workers vs 5k defender',
    nwRange: '$40M–$120M regular; $80M–$200M top at 2×',
    systemsNeedingRebalanceIfApproved: [
      'Scout base recruitment rate (primary)',
      'Poach maxPoachPercent + small-player caps',
      'Optional: combat casualty floor for large armies',
      'How to Play + UI copy expectations',
    ],
  },
};

mkdirSync(join(process.cwd(), 'scripts/output'), { recursive: true });
writeFileSync(OUT, JSON.stringify(output, null, 2));

console.log('Day 30 Workers (Regular) by scale:');
for (const sc of SCALE_SCENARIOS) {
  const d = day30Summary[`${sc.id}_regular`];
  console.log(`  ${sc.label}: ${d.workers}W / ${d.thugs}T / NW $${(d.netWorth / 1e6).toFixed(1)}M`);
}
console.log(`\nWrote ${OUT}`);
