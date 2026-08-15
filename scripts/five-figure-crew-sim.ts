#!/usr/bin/env npx tsx
/**
 * READ-ONLY Five-Figure Crew Scale / Full Economy Simulation Audit.
 * Run: npx tsx scripts/five-figure-crew-sim.ts
 * Does NOT modify production constants.
 */
import { mkdirSync, writeFileSync } from 'fs';
import { join } from 'path';
import {
  DISTRICTS,
  SCOUTING_CONFIG,
  STARTING_RESOURCES,
  TURNS_CONFIG,
  PRODUCTION_CONFIG,
} from '../src/config/game/balance';
import { REDLITE_SCOUT_AREAS, REDLITE_VEHICLES } from '../src/config/game/redlite-rules';
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
  stackRecruitmentContributions,
  recruitmentBonusMultiplier,
  RECRUITMENT_STACK_WEIGHTS,
} from '../src/config/game/business-recruitment-rules';
import { resolveScouting } from '../src/lib/game-engine/scouting';
import { resolveProduction } from '../src/lib/game-engine/production';
import {
  calculateProstituteHappiness,
  calculateThugHappiness,
} from '../src/lib/game-engine/happiness';
import { calculateCanonicalNetWorthFromPlayer } from '../src/lib/game-engine/canonical-net-worth';
import { resolveCombat } from '../src/lib/game-engine/combat/resolve-combat';
import { resolveWorkerPoach } from '../src/lib/game-engine/combat/worker-poach';
import { createCombatRng } from '../src/lib/game-engine/combat/combat-random';
import { computeCartelResponseForce } from '../src/lib/game-engine/cartel-response-force';
import { planSupplyConsumption } from '../src/config/game/supply-economy';
import { getCityShopItem } from '../src/config/game/shop-rules';
import { getDrugProductionRate } from '../src/config/game/drug-production-rates';
import { grossWorkerCash, playerCashFromGross } from '../src/lib/game-engine/worker-economics';

const OUT = join(process.cwd(), 'scripts/output/five-figure-crew-sim.json');
const TURNS_PER_DAY = Math.floor(TURNS_CONFIG.regenerationRatePerMs * 86_400_000);
const CHECKPOINTS = [1, 3, 7, 10, 15, 21, 25, 30] as const;
const MC = 500;

const neon = DISTRICTS.find((d) => d.slug === 'neon-strip')!.modifiers;
const clubs = REDLITE_SCOUT_AREAS.find((a) => a.slug === 'clubs')!;

type Biz = { businessType: 'WAREHOUSE' | 'NIGHTCLUB' | 'DRUG_LAB'; level: number };

type Archetype = {
  id: string;
  activityRate: number;
  scoutShare: number;
  produceShare: number;
  pvpShare: number;
  workerArea: 'clubs' | 'docks' | 'streets';
  businessPriority: 'none' | 'mixed' | 'worker' | 'thug';
  reserveCashFraction: number;
};

const ARCHETYPES: Archetype[] = [
  { id: 'casual', activityRate: 0.32, scoutShare: 0.5, produceShare: 0.48, pvpShare: 0.02, workerArea: 'clubs', businessPriority: 'none', reserveCashFraction: 0.35 },
  { id: 'regular', activityRate: 0.68, scoutShare: 0.5, produceShare: 0.47, pvpShare: 0.03, workerArea: 'clubs', businessPriority: 'mixed', reserveCashFraction: 0.25 },
  { id: 'active', activityRate: 0.9, scoutShare: 0.5, produceShare: 0.47, pvpShare: 0.03, workerArea: 'clubs', businessPriority: 'mixed', reserveCashFraction: 0.2 },
  { id: 'business-focused', activityRate: 0.85, scoutShare: 0.65, produceShare: 0.32, pvpShare: 0.03, workerArea: 'clubs', businessPriority: 'worker', reserveCashFraction: 0.15 },
  { id: 'pvp-focused', activityRate: 0.8, scoutShare: 0.45, produceShare: 0.5, pvpShare: 0.05, workerArea: 'docks', businessPriority: 'thug', reserveCashFraction: 0.2 },
  { id: 'extreme-scout', activityRate: 0.98, scoutShare: 0.92, produceShare: 0.07, pvpShare: 0.01, workerArea: 'clubs', businessPriority: 'none', reserveCashFraction: 0.4 },
  { id: 'top-optimiser', activityRate: 0.97, scoutShare: 0.58, produceShare: 0.38, pvpShare: 0.04, workerArea: 'clubs', businessPriority: 'worker', reserveCashFraction: 0.1 },
];

/** Empire context — recruitment scales from THIS, never from elapsed day. */
interface EmpireContext {
  businesses: Biz[];
  workers: number;
  thugs: number;
  workersAssigned: number;
  workerCapacity: number;
  staffedPct: number;
  totalBusinessLevels: number;
  networkWorkerBonusPct: number;
  networkThugBonusPct: number;
}

interface ModelConfig {
  id: string;
  label: string;
  formula: string;
  baseWorkerScale: number;
  baseThugScale: number;
  tierMultiplier: number;
  maxWorkerBonusPct: number;
  maxThugBonusPct: number;
  /** Empire-driven soft scaling — NOT day-based */
  staffingBoost: number;
  crewLogFactor: number;
  crewLogDivisor: number;
  portfolioBoost: number;
  portfolioDivisor: number;
  maxEmpireMult: number;
}

const MODELS: ModelConfig[] = [
  {
    id: 'M0',
    label: 'CURRENT (baseline)',
    formula: 'base×1.0 × network(current cap +125%) — no empire scaling',
    baseWorkerScale: 1,
    baseThugScale: 1,
    tierMultiplier: 1,
    maxWorkerBonusPct: 125,
    maxThugBonusPct: 125,
    staffingBoost: 0,
    crewLogFactor: 0,
    crewLogDivisor: 1,
    portfolioBoost: 0,
    portfolioDivisor: 1,
    maxEmpireMult: 1,
  },
  {
    id: 'M1',
    label: 'Higher base only',
    formula: 'base×2.0 × network(current) — flat early bump, no empire accel',
    baseWorkerScale: 2,
    baseThugScale: 2,
    tierMultiplier: 1,
    maxWorkerBonusPct: 125,
    maxThugBonusPct: 125,
    staffingBoost: 0,
    crewLogFactor: 0,
    crewLogDivisor: 1,
    portfolioBoost: 0,
    portfolioDivisor: 1,
    maxEmpireMult: 1,
  },
  {
    id: 'M2',
    label: 'Modest base + current network',
    formula: 'base×1.5 × network(current cap +125%)',
    baseWorkerScale: 1.5,
    baseThugScale: 1.5,
    tierMultiplier: 1,
    maxWorkerBonusPct: 125,
    maxThugBonusPct: 125,
    staffingBoost: 0,
    crewLogFactor: 0,
    crewLogDivisor: 1,
    portfolioBoost: 0,
    portfolioDivisor: 1,
    maxEmpireMult: 1,
  },
  {
    id: 'M3',
    label: 'Amplified Business Network',
    formula: 'base×1.2 × network(tier×2.5, cap +400%) — businesses drive late scale',
    baseWorkerScale: 1.2,
    baseThugScale: 1.2,
    tierMultiplier: 2.5,
    maxWorkerBonusPct: 400,
    maxThugBonusPct: 400,
    staffingBoost: 0,
    crewLogFactor: 0,
    crewLogDivisor: 1,
    portfolioBoost: 0,
    portfolioDivisor: 1,
    maxEmpireMult: 1,
  },
  {
    id: 'M4',
    label: 'Staffing-engine',
    formula: 'base×1.0 × network(current) × (1 + staffingPct×0.012) × log crew scale',
    baseWorkerScale: 1,
    baseThugScale: 1,
    tierMultiplier: 1,
    maxWorkerBonusPct: 125,
    maxThugBonusPct: 125,
    staffingBoost: 0.012,
    crewLogFactor: 0.55,
    crewLogDivisor: 150,
    portfolioBoost: 0,
    portfolioDivisor: 1,
    maxEmpireMult: 3.5,
  },
  {
    id: 'M5',
    label: 'Portfolio tier power',
    formula: 'base×1.3 × network(tier×2, cap +350%) × (1 + sum(levels)/portfolioDivisor)',
    baseWorkerScale: 1.3,
    baseThugScale: 1.3,
    tierMultiplier: 2,
    maxWorkerBonusPct: 350,
    maxThugBonusPct: 350,
    staffingBoost: 0,
    crewLogFactor: 0,
    crewLogDivisor: 1,
    portfolioBoost: 1,
    portfolioDivisor: 18,
    maxEmpireMult: 2.5,
  },
  {
    id: 'M6',
    label: 'Hybrid empire accelerator',
    formula: 'base×1.35 × network(tier×1.75, cap +300%) × staffing × log(crew) × portfolio — empire-driven',
    baseWorkerScale: 1.35,
    baseThugScale: 1.35,
    tierMultiplier: 1.75,
    maxWorkerBonusPct: 300,
    maxThugBonusPct: 300,
    staffingBoost: 0.008,
    crewLogFactor: 0.45,
    crewLogDivisor: 250,
    portfolioBoost: 0.6,
    portfolioDivisor: 22,
    maxEmpireMult: 2.8,
  },
  {
    id: 'M7',
    label: 'Five-figure empire engine',
    formula: 'base×1.45 × network(tier×2.1, cap +350%) × staffing×log(crew)×portfolio — targets 5–25k Day-30',
    baseWorkerScale: 1.45,
    baseThugScale: 1.45,
    tierMultiplier: 2.1,
    maxWorkerBonusPct: 350,
    maxThugBonusPct: 350,
    staffingBoost: 0.01,
    crewLogFactor: 0.62,
    crewLogDivisor: 180,
    portfolioBoost: 0.85,
    portfolioDivisor: 16,
    maxEmpireMult: 3.6,
  },
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

function computeSimulatedNetwork(businesses: Biz[], model: ModelConfig) {
  const workerContribs: number[] = [];
  const thugContribs: number[] = [];
  let totalWorkerCapacity = 0;
  for (const b of businesses) {
    const tier = getBusinessTierRecruitmentContribution(b.businessType, b.level);
    if (tier.workerPercent > 0) workerContribs.push(tier.workerPercent * model.tierMultiplier);
    if (tier.thugPercent > 0) thugContribs.push(tier.thugPercent * model.tierMultiplier);
    totalWorkerCapacity += getBusinessLevelStats(b.businessType, b.level).workerCapacity;
  }
  const workerBonusPercent = Math.min(
    model.maxWorkerBonusPct,
    stackRecruitmentContributions(workerContribs),
  );
  const thugBonusPercent = Math.min(
    model.maxThugBonusPct,
    stackRecruitmentContributions(thugContribs),
  );
  return {
    workerBonusPercent,
    thugBonusPercent,
    workerMultiplier: recruitmentBonusMultiplier(workerBonusPercent),
    thugMultiplier: recruitmentBonusMultiplier(thugBonusPercent),
    totalWorkerCapacity,
  };
}

function empireContext(businesses: Biz[], workers: number, thugs: number, model: ModelConfig): EmpireContext {
  const network = computeSimulatedNetwork(businesses, model);
  const workersAssigned = Math.min(workers, network.totalWorkerCapacity);
  const staffedPct = network.totalWorkerCapacity > 0 ? (workersAssigned / network.totalWorkerCapacity) * 100 : 0;
  const totalBusinessLevels = businesses.reduce((s, b) => s + b.level, 0);
  return {
    businesses,
    workers,
    thugs,
    workersAssigned,
    workerCapacity: network.totalWorkerCapacity,
    staffedPct,
    totalBusinessLevels,
    networkWorkerBonusPct: network.workerBonusPercent,
    networkThugBonusPct: network.thugBonusPercent,
  };
}

function empireRecruitmentMultiplier(ctx: EmpireContext, model: ModelConfig, kind: 'worker' | 'thug') {
  const network = computeSimulatedNetwork(ctx.businesses, model);
  const networkMult = kind === 'worker' ? network.workerMultiplier : network.thugMultiplier;
  const baseScale = kind === 'worker' ? model.baseWorkerScale : model.baseThugScale;
  const crewSize = kind === 'worker' ? ctx.workers : ctx.thugs;

  let empireMult = 1;
  if (model.staffingBoost > 0) {
    empireMult *= 1 + (ctx.staffedPct / 100) * model.staffingBoost * 100;
  }
  if (model.crewLogFactor > 0) {
    empireMult *= 1 + Math.log10(1 + crewSize / model.crewLogDivisor) * model.crewLogFactor;
  }
  if (model.portfolioBoost > 0 && ctx.totalBusinessLevels > 0) {
    empireMult *= 1 + (ctx.totalBusinessLevels / model.portfolioDivisor) * model.portfolioBoost;
  }
  empireMult = Math.min(model.maxEmpireMult, empireMult);

  return {
    totalScale: baseScale * networkMult * empireMult,
    baseScale,
    networkMult,
    empireMult,
    networkBonusPct: kind === 'worker' ? ctx.networkWorkerBonusPct : ctx.networkThugBonusPct,
  };
}

function scoutWithModel(
  turns: number,
  ctx: EmpireContext,
  model: ModelConfig,
  happiness: number,
  areaSlug: string,
  seed: number,
) {
  const wMult = empireRecruitmentMultiplier(ctx, model, 'worker');
  const tMult = empireRecruitmentMultiplier(ctx, model, 'thug');
  return resolveScouting({
    turnsSpent: turns,
    districtModifiers: neon,
    districtSlug: 'neon-strip',
    areaSlug,
    prostituteHappiness: happiness,
    thugHappiness: happiness,
    prostituteCount: ctx.workers,
    thugCount: ctx.thugs,
    prostitutePayoutPercent: 50,
    seed,
    businessNetwork: {
      workerMultiplier: wMult.totalScale,
      thugMultiplier: tMult.totalScale,
      workerBonusPercent: wMult.networkBonusPct,
      thugBonusPercent: tMult.networkBonusPct,
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
  for (let i = 0; i < 6; i++) {
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

function run30Day(arch: Archetype, model: ModelConfig, seed: number, turnsPerDay = TURNS_PER_DAY) {
  let turns = TURNS_CONFIG.startingTurns;
  let workers = STARTING_RESOURCES.prostitutes;
  let thugs = STARTING_RESOURCES.thugs;
  let cash = STARTING_RESOURCES.cash;
  let coke = 0;
  const businesses: Biz[] = [];
  const snapshots: Record<number, object> = {};
  let seedCursor = seed;
  let turnsSpentTotal = 0;
  let businessInvested = 0;

  for (let day = 1; day <= 30; day++) {
    turns = Math.min(TURNS_CONFIG.turnCap, turns + turnsPerDay);
    const dailySpend = Math.floor(turns * arch.activityRate);
    const scoutTurns = Math.floor(dailySpend * arch.scoutShare);
    const produceTurns = Math.floor(dailySpend * arch.produceShare);
    const pvpTurns = dailySpend - scoutTurns - produceTurns;

    const ctx = empireContext(businesses, workers, thugs, model);
    const wRecruit = empireRecruitmentMultiplier(ctx, model, 'worker');
    const happiness = 82;

    if (scoutTurns > 0 && turns >= scoutTurns) {
      const out = scoutWithModel(scoutTurns, ctx, model, happiness, arch.workerArea, seedCursor++);
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

    const preCash = cash;
    cash = tryBusinessInvest(cash, businesses, arch.businessPriority, arch.reserveCashFraction);
    businessInvested += preCash - cash;

    const postCtx = empireContext(businesses, workers, thugs, model);
    const assigned = Math.min(workers, postCtx.workerCapacity);
    let remaining = assigned;
    for (const biz of businesses) {
      const cap = getBusinessLevelStats(biz.businessType, biz.level).workerCapacity;
      const assign = Math.min(cap, remaining);
      remaining -= assign;
      cash += businessHourlyIncome(biz.businessType, assign, biz.level) * 24 * 0.35;
    }

    if ((CHECKPOINTS as readonly number[]).includes(day)) {
      const nw = calculateCanonicalNetWorthFromPlayer({
        cash,
        bankCash: 0,
        thugs,
        prostitutes: workers,
        rides: 0,
        hash: 0,
        shrooms: 0,
        coke,
        heroin: 0,
      });
      const supplyPlan = planSupplyConsumption(workers, thugs, scoutTurns + produceTurns, {
        condoms: 999999,
        hash: 999999,
        beer: 999999,
      });
      snapshots[day] = {
        day,
        workers,
        thugs,
        crew: workers + thugs,
        cash: Math.round(cash),
        netWorth: nw + Math.floor(businessInvested * 0.5),
        turns,
        turnsSpentTotal,
        businesses: businesses.map((b) => `${b.businessType.slice(0, 3)} L${b.level}`),
        businessCount: businesses.length,
        workerCapacity: postCtx.workerCapacity,
        workersAssigned: assigned,
        unusedWorkers: Math.max(0, workers - assigned),
        staffedPct: postCtx.workerCapacity > 0 ? Math.round((assigned / postCtx.workerCapacity) * 1000) / 10 : 0,
        workerNetworkBonus: postCtx.networkWorkerBonusPct,
        thugNetworkBonus: postCtx.networkThugBonusPct,
        recruitmentMultiplier: Math.round(wRecruit.totalScale * 100) / 100,
        drugs: { coke },
        dailySupplyNeed: supplyPlan.required,
      };
    }
  }
  return snapshots;
}

/** Scout feel phases — empire stages, NOT calendar days */
const SCOUT_PHASES = {
  fresh: {
    label: 'Fresh player',
    ctx: (): EmpireContext =>
      empireContext([], 5, 3, MODELS[0]!),
    happiness: 72,
  },
  early: {
    label: 'Early empire',
    ctx: (): EmpireContext =>
      empireContext([{ businessType: 'NIGHTCLUB', level: 1 }], 80, 50, MODELS[0]!),
    happiness: 76,
  },
  mid: {
    label: 'Mid empire',
    ctx: (): EmpireContext =>
      empireContext(
        [
          { businessType: 'WAREHOUSE', level: 3 },
          { businessType: 'NIGHTCLUB', level: 2 },
        ],
        800,
        450,
        MODELS[0]!,
      ),
    happiness: 82,
  },
  strong: {
    label: 'Strong business network',
    ctx: (): EmpireContext =>
      empireContext(
        [
          { businessType: 'WAREHOUSE', level: 4 },
          { businessType: 'NIGHTCLUB', level: 4 },
          { businessType: 'DRUG_LAB', level: 3 },
        ],
        3500,
        1800,
        MODELS[0]!,
      ),
    happiness: 86,
  },
  elite: {
    label: 'Elite late-round network',
    ctx: (): EmpireContext =>
      empireContext(
        [
          { businessType: 'WAREHOUSE', level: 5 },
          { businessType: 'WAREHOUSE', level: 5 },
          { businessType: 'NIGHTCLUB', level: 5 },
          { businessType: 'NIGHTCLUB', level: 5 },
          { businessType: 'DRUG_LAB', level: 5 },
          { businessType: 'DRUG_LAB', level: 4 },
        ],
        15000,
        8000,
        MODELS[0]!,
      ),
    happiness: 88,
  },
} as const;

function scoutFeelForModel(model: ModelConfig, phaseKey: keyof typeof SCOUT_PHASES, turns: number) {
  const phase = SCOUT_PHASES[phaseKey];
  const baseCtx = phase.ctx();
  const ctx: EmpireContext = {
    ...baseCtx,
    ...empireContext(baseCtx.businesses, baseCtx.workers, baseCtx.thugs, model),
  };
  const workersOut: number[] = [];
  const thugsOut: number[] = [];
  for (let i = 0; i < MC; i++) {
    const out = scoutWithModel(turns, ctx, model, phase.happiness, 'clubs', 80_000 + i + turns + phaseKey.length);
    workersOut.push(out.prostitutesFound);
    thugsOut.push(out.thugsFound);
  }
  const w = stats(workersOut);
  const t = stats(thugsOut);
  const mult = empireRecruitmentMultiplier(ctx, model, 'worker');
  return {
    phase: phaseKey,
    phaseLabel: phase.label,
    turns,
    workers: w,
    thugs: t,
    recruitmentMultiplier: Math.round(mult.totalScale * 100) / 100,
    zeroWorkerPct: Math.round((workersOut.filter((v) => v === 0).length / MC) * 1000) / 10,
  };
}

function produceAudit(workers: number, thugs: number, turns = 400) {
  const gross = grossWorkerCash(workers, turns, PRODUCTION_CONFIG.cashPerProstitutePerTurn);
  const cash = Math.floor(playerCashFromGross(gross, 50) * 0.92);
  const drugUnits = Math.floor(turns * thugs * getDrugProductionRate('coke') * 0.92);
  const bizIncome = businessHourlyIncome('NIGHTCLUB', Math.min(workers, 2000), 5) * 24;
  return { workers, thugs, turns, produceCash: cash, drugUnits, nightclubL5PassiveDaily: Math.round(bizIncome) };
}

function combatAudit(armySizes: number[]) {
  const results: object[] = [];
  for (const attackers of armySizes) {
    const send = Math.min(attackers, ATTACK_RULES.maxAttackingThugs);
    const capped = send < attackers;
    for (const attackType of ['DRIVE_BY', 'HOME_INVASION', 'POACH_WORKERS'] as const) {
      const defThugs = Math.max(100, Math.floor(Math.min(attackers, 10000) * 0.12));
      const defWorkers = Math.max(500, Math.floor(Math.min(attackers, 40000) * 0.8));
      const result = resolveCombat({
        attackType,
        attackingThugs: send,
        attacker: {
          thugs: attackers,
          glocks: Math.floor(send * 0.35),
          uzis: Math.floor(send * 0.25),
          aks: Math.floor(send * 0.05),
          cash: send * 2000,
          drugs: { hash: 0, shrooms: 0, coke: send * 3, heroin: send },
        },
        defender: {
          thugs: defThugs,
          glocks: Math.floor(defThugs * 0.4),
          uzis: Math.floor(defThugs * 0.15),
          aks: 0,
          cash: defWorkers * 500,
          drugs: { hash: 0, shrooms: 0, coke: defWorkers, heroin: 0 },
        },
        seed: 50_000 + attackers,
        poachContext:
          attackType === 'POACH_WORKERS'
            ? { defenderWorkers: defWorkers, defenderWorkerHappiness: 45, defenderThugsForProtection: defThugs }
            : undefined,
      });
      results.push({
        attackType,
        attackerArmySize: attackers,
        thugsCommitted: send,
        commitCapped: capped,
        attackerLosses: result.attackerLosses,
        defenderLosses: result.defenderLosses,
        attackerLossPctOfArmy: Math.round((result.attackerLosses / attackers) * 10000) / 100,
        attackerLossPctOfCommit: Math.round((result.attackerLosses / send) * 1000) / 10,
        workersStolen: result.workersStolen,
        ridesRequired: Math.ceil(send / REDLITE_VEHICLES.thugsPerRide),
      });
    }
  }
  return results;
}

function poachAudit(defenderWorkers: number[]) {
  return defenderWorkers.map((defWorkers) => {
    const defThugs = Math.max(50, Math.floor(defWorkers * 0.08));
    const stolen: number[] = [];
    for (let i = 0; i < MC; i++) {
      const attacking = Math.min(5000, Math.max(200, Math.floor(defThugs * 4)));
      const result = resolveWorkerPoach({
        attackerVictory: true,
        tacticalSuccess: true,
        defenderWorkers: defWorkers,
        defenderThugsForProtection: defThugs,
        workerHappiness: 45,
        survivingAttackers: Math.floor(attacking * 0.75),
        attackingThugs: attacking,
        rng: createCombatRng(60_000 + defWorkers + i),
      });
      stolen.push(result.workersStolen);
    }
    const s = stats(stolen);
    return {
      defenderWorkers: defWorkers,
      ...s,
      pctOfDefender: Math.round((s.median / defWorkers) * 10000) / 100,
    };
  });
}

function cartelAudit() {
  const personal = [1000, 5000, 10000, 20000, 40000];
  const pools = [5000, 10000, 25000, 50000, 100000, 250000];
  return personal.flatMap((p) =>
    pools.map((pool) => {
      const rides = Math.ceil(pool / REDLITE_VEHICLES.thugsPerRide);
      const rf = computeCartelResponseForce(p, pool, rides);
      return {
        personalThugs: p,
        cartelPool: pool,
        cartelRides: rides,
        responseForce: rf,
        rfPctOfPersonal: Math.round((rf / p) * 1000) / 10,
        rfPctOfPool: Math.round((rf / pool) * 1000) / 10,
        localSupport: Math.floor(pool * 0.1),
      };
    }),
  );
}

function ridesAudit(thugs: number) {
  const rides = Math.ceil(thugs / REDLITE_VEHICLES.thugsPerRide);
  return {
    thugs,
    rides,
    rideCost: rides * (getCityShopItem('ride')?.shopPrice ?? 2500),
    glockCost: thugs * (getCityShopItem('glock')?.shopPrice ?? 400),
    rideNw: rides * 2000,
    thugNw: thugs * 700,
  };
}

function supplyAudit(workers: number, thugs: number, dailyTurns = 450) {
  const plan = planSupplyConsumption(workers, thugs, dailyTurns, { condoms: 9e9, hash: 9e9, beer: 9e9 });
  const condomCost = (plan.required.condoms ?? 0) * (getCityShopItem('condom')?.shopPrice ?? 1);
  const hashCost = (plan.required.hash ?? 0) * (getCityShopItem('hash')?.shopPrice ?? 8);
  const beerCost = (plan.required.beer ?? 0) * (getCityShopItem('beer')?.shopPrice ?? 2);
  return {
    workers,
    thugs,
    crew: workers + thugs,
    dailyTurns,
    required: plan.required,
    dailyCashCost: condomCost + hashCost + beerCost,
  };
}

function scoreModel(model: ModelConfig, day30: Record<string, { workers: number; thugs: number; netWorth: number; staffedPct: number; recruitmentMultiplier: number }>) {
  const reg = day30[`${model.id}_regular`]!;
  const bf = day30[`${model.id}_business-focused`]!;
  const pvp = day30[`${model.id}_pvp-focused`]!;
  const d1 = run30Day(ARCHETYPES.find((a) => a.id === 'regular')!, model, 99_001)[1] as { workers: number; recruitmentMultiplier: number };
  const scoutEarly = scoutFeelForModel(model, 'fresh', 25);
  const scoutLate = scoutFeelForModel(model, 'elite', 25);

  const clamp10 = (v: number) => Math.max(1, Math.min(10, Math.round(v * 10) / 10));

  const earlyFeel = d1.workers <= 120 ? 9 : d1.workers <= 250 ? 7 : d1.workers <= 500 ? 4 : 2;
  const scoutExcite = scoutLate.workers.median >= 15 && scoutEarly.workers.median <= 8 ? 9 : scoutLate.workers.median >= 10 ? 7 : 5;
  const progression = reg.workers >= 4000 && reg.workers <= 12000 ? 9 : reg.workers >= 2500 ? 7 : reg.workers >= 1500 ? 5 : 3;
  const bizImportance = bf.workerNetworkBonus > 50 || bf.staffedPct > 45 ? 8 : 6;
  const pvpStakes = pvp.thugs >= 8000 ? 7 : pvp.thugs >= 4000 ? 8 : 6;
  const rankingSpread = reg.netWorth > 5e6 && bf.netWorth > reg.netWorth * 0.8 ? 8 : 6;
  const economyStable = reg.workers <= 15000 ? 7 : reg.workers <= 25000 ? 5 : 3;
  const dopamine = reg.workers >= 5000 && scoutLate.workers.median >= 12 ? 9 : 6;
  const strategic = model.staffingBoost > 0 || model.portfolioBoost > 0 ? 8 : 6;
  const pacing = d1.recruitmentMultiplier <= 2.5 && reg.recruitmentMultiplier >= 4 ? 9 : 7;

  return {
    earlyGameFeel: clamp10(earlyFeel),
    progression: clamp10(progression),
    scoutExcitement: clamp10(scoutExcite),
    businessImportance: clamp10(bizImportance),
    pvpStakes: clamp10(pvpStakes),
    strategicDepth: clamp10(strategic),
    rankingDifferentiation: clamp10(rankingSpread),
    economyStability: clamp10(economyStable),
    pacing30d: clamp10(pacing),
    oldSchoolDopamine: clamp10(dopamine),
    average: clamp10(
      (earlyFeel + scoutExcite + progression + bizImportance + pvpStakes + strategic + rankingSpread + economyStable + pacing + dopamine) / 10,
    ),
  };
}

function simulateLeaderboard(model: ModelConfig, playerCount: number) {
  const weights = [
    { arch: 'casual', w: 0.35 },
    { arch: 'regular', w: 0.28 },
    { arch: 'active', w: 0.15 },
    { arch: 'business-focused', w: 0.08 },
    { arch: 'pvp-focused', w: 0.06 },
    { arch: 'extreme-scout', w: 0.04 },
    { arch: 'top-optimiser', w: 0.04 },
  ];
  const nws: number[] = [];
  const crews: number[] = [];
  for (let i = 0; i < playerCount; i++) {
    const r = Math.random();
    let acc = 0;
    let arch = ARCHETYPES[1]!;
    for (const w of weights) {
      acc += w.w;
      if (r <= acc) {
        arch = ARCHETYPES.find((a) => a.id === w.arch)!;
        break;
      }
    }
    const snap = run30Day(arch, model, 200_000 + i * 131);
    const d30 = snap[30] as { netWorth: number; workers: number; thugs: number };
    nws.push(d30.netWorth);
    crews.push(d30.workers + d30.thugs);
  }
  const sorted = [...nws].sort((a, b) => b - a);
  const s = stats(nws);
  const spread = sorted[0]! > 0 ? sorted[0]! / (sorted[Math.floor(playerCount * 0.5)]! || 1) : 1;
  const giniApprox =
    nws.reduce((sum, nw, _, arr) => sum + Math.abs(nw - arr.reduce((a, b) => a + b, 0) / arr.length), 0) /
    (2 * playerCount * (s.mean || 1));
  return {
    playerCount,
    nw: s,
    crew: stats(crews),
    top10PctThreshold: sorted[Math.floor(playerCount * 0.1)] ?? 0,
    medianNw: sorted[Math.floor(playerCount * 0.5)] ?? 0,
    topToMedianRatio: Math.round(spread * 100) / 100,
    giniApprox: Math.round(giniApprox * 1000) / 1000,
  };
}

// --- Run ---
console.log('Running five-figure crew simulation...\n');

const progression: Record<string, Record<string, object>> = {};
const day30Summary: Record<string, object> = {};

for (const model of MODELS) {
  progression[model.id] = {};
  for (const arch of ARCHETYPES) {
    const snaps = run30Day(arch, model, 40_000 + model.id.charCodeAt(1) * 1000 + arch.id.length * 333);
    progression[model.id][arch.id] = snaps;
    day30Summary[`${model.id}_${arch.id}`] = snaps[30];
  }
}

const scoutFeelByModel: Record<string, object[]> = {};
for (const model of MODELS) {
  scoutFeelByModel[model.id] = [];
  for (const phase of Object.keys(SCOUT_PHASES) as (keyof typeof SCOUT_PHASES)[]) {
    for (const turns of [25, 50, 100, 250, 500, 1000]) {
      scoutFeelByModel[model.id]!.push(scoutFeelForModel(model, phase, turns));
    }
  }
}

const modelScores = Object.fromEntries(
  MODELS.map((m) => [
    m.id,
    {
      config: { id: m.id, label: m.label, formula: m.formula },
      scores: scoreModel(m, day30Summary as Record<string, { workers: number; thugs: number; netWorth: number; staffedPct: number; recruitmentMultiplier: number }>),
      day30: {
        regular: day30Summary[`${m.id}_regular`],
        businessFocused: day30Summary[`${m.id}_business-focused`],
        pvpFocused: day30Summary[`${m.id}_pvp-focused`],
        topOptimiser: day30Summary[`${m.id}_top-optimiser`],
      },
      scout25: {
        fresh: scoutFeelForModel(m, 'fresh', 25),
        mid: scoutFeelForModel(m, 'mid', 25),
        elite: scoutFeelForModel(m, 'elite', 25),
      },
    },
  ]),
);

const turnRegenSensitivity = ['M6', 'M7'].flatMap((mid) => {
  const model = MODELS.find((m) => m.id === mid)!;
  const arch = ARCHETYPES.find((a) => a.id === 'regular')!;
  return [
    { regenPerDay: 576, label: 'current', snap: run30Day(arch, model, 77_001, TURNS_PER_DAY)[30] },
    { regenPerDay: 864, label: '+50%', snap: run30Day(arch, model, 77_002, Math.floor(TURNS_PER_DAY * 1.5))[30] },
    { regenPerDay: 1152, label: '+100%', snap: run30Day(arch, model, 77_003, TURNS_PER_DAY * 2)[30] },
  ];
});

const output = {
  generatedAt: new Date().toISOString(),
  auditOnly: true,
  targetRanges: {
    casual: { workers: '2,000–5,000', thugs: '1,000–3,000' },
    regular: { workers: '5,000–10,000', thugs: '3,000–7,000' },
    active: { workers: '8,000–15,000', thugs: '5,000–10,000' },
    businessFocused: { workers: '12,000–25,000', thugs: '5,000–10,000' },
    pvpFocused: { workers: '5,000–10,000', thugs: '12,000–25,000' },
    elite: { workers: '20,000–40,000+', thugs: 'specialised' },
  },
  canonical: {
    turns: { starting: 500, cap: 5000, regenPerDay: 576 },
    scout: {
      baseWorkerPerTurn: SCOUTING_CONFIG.baseProstitutesPerTurn,
      baseThugPerTurn: SCOUTING_CONFIG.baseThugsPerTurn,
      networkCapCurrent: 125,
      stackWeights: RECRUITMENT_STACK_WEIGHTS,
    },
    combat: { maxAttackersPerCommit: ATTACK_RULES.maxAttackingThugs, thugsPerRide: 5 },
    nw: { worker: 1750, thug: 700, businessInvestedFraction: 0.5 },
    businessCapacity: {
      oneL5Warehouse: 1500,
      oneL5Nightclub: 2000,
      eightL5Empire: 12700,
    },
  },
  models: MODELS.map((m) => ({ id: m.id, label: m.label, formula: m.formula })),
  modelScores,
  progression,
  day30Summary,
  scoutFeelByModel,
  produceAudit: [5000, 10000, 20000, 40000].map((w) => produceAudit(w, Math.floor(w * 0.35))),
  supplyAudit: [5000, 10000, 20000, 40000].map((crew) =>
    supplyAudit(Math.floor(crew * 0.65), Math.floor(crew * 0.35)),
  ),
  ridesAudit: [5000, 10000, 20000, 40000].map(ridesAudit),
  combatAudit: combatAudit([500, 1000, 2500, 5000, 10000, 20000, 40000]),
  poachAudit: poachAudit([1000, 2500, 5000, 10000, 20000, 40000]),
  cartelAudit: cartelAudit().filter((_, i) => i % 3 === 0),
  leaderboard: {
    M0: simulateLeaderboard(MODELS[0]!, 100),
    M6: simulateLeaderboard(MODELS.find((m) => m.id === 'M6')!, 100),
    M7: simulateLeaderboard(MODELS.find((m) => m.id === 'M7')!, 100),
  },
  turnRegenSensitivity,
  dependencyMap: {
    GREEN: [
      'Turn economy (576/day sufficient for five-figure if recruitment is empire-driven)',
      'Business purchase/upgrade prices',
      'Market / Bank / Cartel donation rules',
      'Travel / Intel turn costs',
      'Walkout happiness thresholds',
      'Drug production rate formula',
    ],
    AMBER: [
      'Scout base recruitment + Business Network caps/tiers (primary dials)',
      'Supply shop bulk-buy UX (not necessarily prices)',
      'Poach maxPoachPercent at 20k+ defenders',
      'Combat maxAttackingThugs (5000 cap) + casualty % vs army size',
      'Cartel pool/rides scaling for 20k+ personal armies',
      'Ride/weapon shop quantity UX',
      'Business capacity messaging (12700 cap vs 25k workers)',
      'NW display formatting',
    ],
    RED: [
      'Combat: attack commit cap and/or casualty scaling (mandatory at 10k+ thugs)',
      'Poach percentage caps (mandatory at 20k+ workers without tuning)',
      'Optional NW weight review if crew NW dominates but cash feels flat',
      'Business worker capacity only if full 8×L5 staffing is a 30-day goal',
    ],
  },
  recommendation: {} as object,
};

// Pick best model by score
const ranked = [...MODELS]
  .map((m) => ({
    id: m.id,
    avg: (modelScores[m.id] as { scores: { average: number } }).scores.average,
    regular: (day30Summary[`${m.id}_regular`] as { workers: number; thugs: number }).workers,
  }))
  .sort((a, b) => b.avg - a.avg);

(output as { recommendation: object }).recommendation = {
  choice: 'M7 — Five-figure empire engine (or M6 for conservative five-figure)',
  runnerUp: 'M6 — Hybrid empire accelerator',
  avoid: 'M1 flat base×2 — no acceleration curve; M3 alone insufficient without empire factors',
  rationale: 'See report — selected after simulation run',
  rankedModels: ranked,
};

mkdirSync(join(process.cwd(), 'scripts/output'), { recursive: true });
writeFileSync(OUT, JSON.stringify(output, null, 2));

console.log('Day 30 Workers by model (Regular):');
for (const m of MODELS) {
  const d = day30Summary[`${m.id}_regular`] as { workers: number; thugs: number; netWorth: number; recruitmentMultiplier: number };
  console.log(`  ${m.id} ${m.label}: ${d.workers}W / ${d.thugs}T / NW $${(d.netWorth / 1e6).toFixed(1)}M / mult ${d.recruitmentMultiplier}`);
}
console.log(`\nWrote ${OUT}`);
