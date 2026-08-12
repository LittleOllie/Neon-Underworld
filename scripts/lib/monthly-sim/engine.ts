/**
 * 30-day empire simulation engine — uses live game config/functions only.
 */
import { STARTING_RESOURCES, DISTRICTS, TURNS_CONFIG, PRODUCTION_CONFIG } from '../../../src/config/game/balance';
import { ATTACK_RULES } from '../../../src/config/game/attack-rules';
import { REDLITE_TRAVEL } from '../../../src/config/game/redlite-rules';
import { getDrugStreetPrice, type StreetDrugType } from '../../../src/config/game/drug-street-prices';
import { getCityShopItem } from '../../../src/config/game/shop-rules';
import { resolveScouting } from '../../../src/lib/game-engine/scouting';
import { resolveProduction, type ProductionDrug } from '../../../src/lib/game-engine/production';
import { resolveSupplyConsumptionForAction } from '../../../src/lib/game-engine/supply-consumption';
import {
  calculateProstituteHappiness,
  calculateThugHappiness,
} from '../../../src/lib/game-engine/happiness';
import { calculateCanonicalNetWorthFromPlayer } from '../../../src/lib/game-engine/canonical-net-worth';
import { resolveCombat } from '../../../src/lib/game-engine/combat/resolve-combat';
import { estimateHashProduceNet } from '../../../src/lib/game-engine/produce-economy';
import type { DistrictSlug } from '../../../src/config/game/scout-area-names';

export const TURNS_PER_DAY = Math.floor(TURNS_CONFIG.regenerationRatePerMs * 86_400_000);
export const SIM_DAYS = 30;
export const CHECKPOINT_DAYS = [1, 3, 7, 14, 21, 30] as const;

export type ArchetypeId =
  | 'casual'
  | 'balanced'
  | 'economy'
  | 'aggressive'
  | 'power';

export type ScoutAreaSlug = 'streets' | 'clubs' | 'docks' | 'alleys' | 'markets';

export interface PhaseAllocation {
  scout: number;
  produce: number;
  combat: number;
  other: number;
}

export interface ArchetypeConfig {
  id: ArchetypeId;
  label: string;
  /** Fraction of daily regen turns actively spent */
  activityRate: number;
  /** Extra bank spend rate for power users (fraction of regen) */
  bankSpendBonus: number;
  payoutPercent: number;
  primaryScoutArea: ScoutAreaSlug;
  secondaryScoutArea?: ScoutAreaSlug;
  preferredProduceDrug: ProductionDrug | 'mixed';
  attacksPerDay: { min: number; max: number };
  weaponTier: 'glock' | 'uzi' | 'mixed';
  travelEnabled: boolean;
  phases: { untilDay: number; allocation: PhaseAllocation }[];
}

export interface SimState {
  day: number;
  turns: number;
  cash: number;
  bankCash: number;
  prostitutes: number;
  thugs: number;
  glocks: number;
  uzis: number;
  aks: number;
  rides: number;
  hash: number;
  condoms: number;
  beer: number;
  shrooms: number;
  coke: number;
  heroin: number;
  prostitutePayoutPercent: number;
  district: DistrictSlug;
  cumScoutCash: number;
  cumProduceCash: number;
  cumDrugSales: number;
  cumSupplySpend: number;
  cumWeaponSpend: number;
  cumRideSpend: number;
  cumCombatCashGain: number;
  cumCombatCashLoss: number;
  cumCombatDrugGain: number;
  cumCombatDrugLoss: number;
  cumThugsLostCombat: number;
  cumThugsRecoveredScout: number;
  turnsSpentTotal: number;
}

export interface CheckpointSnapshot {
  day: number;
  prostitutes: number;
  thugs: number;
  cash: number;
  hash: number;
  shrooms: number;
  coke: number;
  heroin: number;
  glocks: number;
  uzis: number;
  aks: number;
  rides: number;
  netWorth: number;
  cumScoutCash: number;
  cumProduceCash: number;
  cumDrugSales: number;
  cumSupplySpend: number;
  cumWeaponSpend: number;
  cumCombatCashGain: number;
  cumCombatCashLoss: number;
  turnsSpentTotal: number;
}

function districtModifiers(slug: DistrictSlug) {
  return DISTRICTS.find((d) => d.slug === slug)!.modifiers;
}

function shopPrice(key: string): number {
  return getCityShopItem(key as 'hash')!.shopPrice;
}

export function createInitialState(district: DistrictSlug = 'neon-strip'): SimState {
  const s = STARTING_RESOURCES;
  return {
    day: 0,
    turns: TURNS_CONFIG.startingTurns,
    cash: s.cash,
    bankCash: 0,
    prostitutes: s.prostitutes,
    thugs: s.thugs,
    glocks: s.glocks,
    uzis: s.uzis,
    aks: s.aks,
    rides: s.rides,
    hash: s.hash,
    condoms: s.condoms,
    beer: s.beer,
    shrooms: s.shrooms,
    coke: s.coke,
    heroin: s.heroin,
    prostitutePayoutPercent: s.prostitutePayoutPercent,
    district,
    cumScoutCash: 0,
    cumProduceCash: 0,
    cumDrugSales: 0,
    cumSupplySpend: 0,
    cumWeaponSpend: 0,
    cumRideSpend: 0,
    cumCombatCashGain: 0,
    cumCombatCashLoss: 0,
    cumCombatDrugGain: 0,
    cumCombatDrugLoss: 0,
    cumThugsLostCombat: 0,
    cumThugsRecoveredScout: 0,
    turnsSpentTotal: 0,
  };
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

function restockSupplies(state: SimState): void {
  const hashTarget = Math.max(state.prostitutes * 2, 20);
  const condomTarget = Math.max(state.prostitutes * 4, 20);
  const beerTarget = Math.max(state.thugs * 2, 10);
  const buy = (field: 'hash' | 'condoms' | 'beer', key: string, target: number) => {
    const current = state[field];
    const need = Math.max(0, target - current);
    if (need <= 0) return;
    const cost = need * shopPrice(key);
    if (state.cash < cost) {
      const affordable = Math.floor(state.cash / shopPrice(key));
      state[field] += affordable;
      state.cash -= affordable * shopPrice(key);
      state.cumSupplySpend += affordable * shopPrice(key);
      return;
    }
    state[field] += need;
    state.cash -= cost;
    state.cumSupplySpend += cost;
  };
  buy('hash', 'hash', hashTarget);
  buy('condoms', 'condom', condomTarget);
  buy('beer', 'beer', beerTarget);
}

function maintainArsenal(state: SimState, tier: ArchetypeConfig['weaponTier']): void {
  const armedTarget = Math.max(state.thugs, 1);
  let needGlocks = 0;
  let needUzis = 0;
  if (tier === 'glock') {
    needGlocks = Math.max(0, armedTarget - state.glocks - state.uzis - state.aks);
  } else if (tier === 'uzi') {
    const uziTarget = Math.floor(armedTarget * 0.6);
    needUzis = Math.max(0, uziTarget - state.uzis);
    needGlocks = Math.max(0, armedTarget - state.glocks - state.uzis - state.aks - needUzis);
  } else {
    const uziTarget = Math.floor(armedTarget * 0.4);
    const akTarget = Math.floor(armedTarget * 0.2);
    const needAks = Math.max(0, akTarget - state.aks);
    needUzis = Math.max(0, uziTarget - state.uzis);
    needGlocks = Math.max(0, armedTarget - state.glocks - state.uzis - state.aks - needUzis - needAks);
    if (needAks > 0 && state.cash >= needAks * shopPrice('ak')) {
      state.aks += needAks;
      state.cash -= needAks * shopPrice('ak');
      state.cumWeaponSpend += needAks * shopPrice('ak');
    }
  }
  if (needUzis > 0 && state.cash >= needUzis * shopPrice('uzi')) {
    state.uzis += needUzis;
    state.cash -= needUzis * shopPrice('uzi');
    state.cumWeaponSpend += needUzis * shopPrice('uzi');
  }
  if (needGlocks > 0 && state.cash >= needGlocks * shopPrice('glock')) {
    state.glocks += needGlocks;
    state.cash -= needGlocks * shopPrice('glock');
    state.cumWeaponSpend += needGlocks * shopPrice('glock');
  }
}

function maintainRides(state: SimState): void {
  const crew = state.prostitutes + state.thugs;
  const needed = Math.max(1, Math.ceil(crew / REDLITE_TRAVEL.crewPerRide));
  const toBuy = Math.max(0, needed - state.rides);
  if (toBuy > 0 && state.cash >= toBuy * shopPrice('ride')) {
    state.rides += toBuy;
    state.cash -= toBuy * shopPrice('ride');
    state.cumRideSpend += toBuy * shopPrice('ride');
  }
}

function pickProduceDrug(state: SimState, pref: ArchetypeConfig['preferredProduceDrug']): ProductionDrug {
  if (pref !== 'mixed') return pref;
  const prices = {
    coke: getDrugStreetPrice(state.district, 'coke'),
    heroin: getDrugStreetPrice(state.district, 'heroin'),
    shrooms: getDrugStreetPrice(state.district, 'shrooms'),
    hash: getDrugStreetPrice(state.district, 'hash'),
  };
  const hashNet = estimateHashProduceNet({
    prostitutes: state.prostitutes,
    thugs: state.thugs,
    turnsSpent: 100,
    thugHappiness: morale(state).thug,
  });
  if (hashNet.netHash < 0 && state.hash < state.prostitutes) return 'hash';
  if (prices.heroin >= prices.coke) return 'heroin';
  return 'coke';
}

function sellDrugs(state: SimState, sellFraction: number): void {
  const drugs: StreetDrugType[] = ['heroin', 'coke', 'shrooms'];
  for (const drug of drugs) {
    const field = drug === 'shrooms' ? 'shrooms' : drug;
    const qty = state[field as keyof SimState] as number;
    const toSell = Math.floor(qty * sellFraction);
    if (toSell <= 0) continue;
    const price = getDrugStreetPrice(state.district, drug);
    state[field as keyof SimState] = qty - toSell;
    state.cash += toSell * price;
    state.cumDrugSales += toSell * price;
  }
}

function phaseAllocation(config: ArchetypeConfig, day: number): PhaseAllocation {
  for (const phase of config.phases) {
    if (day <= phase.untilDay) return phase.allocation;
  }
  return config.phases[config.phases.length - 1]!.allocation;
}

function scoutArea(config: ArchetypeConfig, day: number): ScoutAreaSlug {
  if (day <= 7) return config.primaryScoutArea;
  return config.secondaryScoutArea ?? config.primaryScoutArea;
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
  state.cumThugsRecoveredScout += outcome.thugsFound;
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
  if (drug === 'hash') {
    state.hash += outcome.drugUnitsProduced;
  } else {
    state[drug] += outcome.drugUnitsProduced;
  }
}

function doAttack(state: SimState, seed: number, strengthMult: number): void {
  const attackTurns = ATTACK_RULES.turnCosts.HOME_INVASION;
  if (state.turns < attackTurns || state.thugs < 10) return;
  const send = Math.min(state.thugs, Math.max(10, Math.floor(state.thugs * 0.25)));
  const defThugs = Math.max(5, Math.floor(send * strengthMult));
  const m = morale(state);
  const result = resolveCombat({
    attackType: 'HOME_INVASION',
    attackingThugs: send,
    attacker: {
      thugs: state.thugs,
      glocks: state.glocks,
      uzis: state.uzis,
      aks: state.aks,
      cash: state.cash,
      drugs: { hash: state.hash, shrooms: state.shrooms, coke: state.coke, heroin: state.heroin },
    },
    defender: {
      thugs: defThugs,
      glocks: Math.floor(defThugs * 0.5),
      uzis: Math.floor(defThugs * 0.2),
      aks: 0,
      cash: defThugs * 500,
      drugs: { hash: 0, shrooms: 0, coke: defThugs * 2, heroin: defThugs },
    },
    seed,
  });
  state.turns -= attackTurns;
  state.turnsSpentTotal += attackTurns;
  state.thugs = Math.max(0, state.thugs - result.attackerLosses);
  state.glocks = Math.max(0, state.glocks - result.attackerWeaponLosses.glocks);
  state.uzis = Math.max(0, state.uzis - result.attackerWeaponLosses.uzis);
  state.aks = Math.max(0, state.aks - result.attackerWeaponLosses.aks);
  state.cumThugsLostCombat += result.attackerLosses;
  state.cash += result.cashStolen;
  state.cumCombatCashGain += result.cashStolen;
  const stolen = result.drugsStolen;
  state.hash += stolen.hash;
  state.shrooms += stolen.shrooms;
  state.coke += stolen.coke;
  state.heroin += stolen.heroin;
  state.cumCombatDrugGain +=
    (stolen.hash + stolen.shrooms + stolen.coke + stolen.heroin) * 5;
}

function maybeTravel(state: SimState, config: ArchetypeConfig): void {
  if (!config.travelEnabled || state.turns < REDLITE_TRAVEL.turnCost) return;
  const districts: DistrictSlug[] = ['neon-strip', 'docklands', 'old-quarter'];
  const best = districts
    .map((d) => ({
      d,
      val:
        state.coke * getDrugStreetPrice(d, 'coke') +
        state.heroin * getDrugStreetPrice(d, 'heroin'),
    }))
    .sort((a, b) => b.val - a.val)[0];
  if (!best || best.d === state.district) return;
  const currentVal =
    state.coke * getDrugStreetPrice(state.district, 'coke') +
    state.heroin * getDrugStreetPrice(state.district, 'heroin');
  const inventory = state.coke + state.heroin;
  if (inventory < 100 || best.val - currentVal < 5000) return;
  state.turns -= REDLITE_TRAVEL.turnCost;
  state.turnsSpentTotal += REDLITE_TRAVEL.turnCost;
  state.district = best.d;
}

export function runSimulation(
  config: ArchetypeConfig,
  seed: number,
  district: DistrictSlug = 'neon-strip',
): CheckpointSnapshot[] {
  const state = createInitialState(district);
  state.prostitutePayoutPercent = config.payoutPercent;
  const snapshots: CheckpointSnapshot[] = [];
  let rng = seed;

  const nextSeed = () => {
    rng = (rng * 1664525 + 1013904223) >>> 0;
    return rng;
  };

  for (let day = 1; day <= SIM_DAYS; day++) {
    state.day = day;
    state.turns = Math.min(TURNS_CONFIG.turnCap, state.turns + TURNS_PER_DAY);

    const dailyBudget = Math.floor(
      TURNS_PER_DAY * config.activityRate +
        TURNS_PER_DAY * config.bankSpendBonus,
    );
    let budget = Math.min(state.turns, Math.max(50, dailyBudget));
    const alloc = phaseAllocation(config, day);
    const area = scoutArea(config, day);

    const scoutTurns = Math.floor(budget * alloc.scout);
    const produceTurns = Math.floor(budget * alloc.produce);
    const combatTurns = Math.floor(budget * alloc.combat);
    budget -= scoutTurns + produceTurns + combatTurns;

    const scoutChunks = scoutTurns > 0 ? [scoutTurns] : [];
    const produceChunks = produceTurns > 0 ? [produceTurns] : [];

    for (const t of scoutChunks) doScout(state, t, area, nextSeed());
    for (const t of produceChunks) {
      const drug = pickProduceDrug(state, config.preferredProduceDrug);
      doProduce(state, t, drug, nextSeed());
    }

    const attacks =
      config.attacksPerDay.min +
      Math.floor(nextSeed() % (config.attacksPerDay.max - config.attacksPerDay.min + 1));
    for (let a = 0; a < attacks; a++) {
      const mult = 0.7 + (nextSeed() % 100) / 200;
      doAttack(state, nextSeed(), mult);
    }

    if (config.travelEnabled) maybeTravel(state, config);
    sellDrugs(state, config.id === 'economy' ? 0.35 : config.id === 'power' ? 0.25 : 0.15);
    restockSupplies(state);
    maintainArsenal(state, config.weaponTier);
    maintainRides(state);

    if (CHECKPOINT_DAYS.includes(day as (typeof CHECKPOINT_DAYS)[number])) {
      snapshots.push({
        day,
        prostitutes: state.prostitutes,
        thugs: state.thugs,
        cash: state.cash,
        hash: state.hash,
        shrooms: state.shrooms,
        coke: state.coke,
        heroin: state.heroin,
        glocks: state.glocks,
        uzis: state.uzis,
        aks: state.aks,
        rides: state.rides,
        netWorth: nw(state),
        cumScoutCash: state.cumScoutCash,
        cumProduceCash: state.cumProduceCash,
        cumDrugSales: state.cumDrugSales,
        cumSupplySpend: state.cumSupplySpend,
        cumWeaponSpend: state.cumWeaponSpend,
        cumCombatCashGain: state.cumCombatCashGain,
        cumCombatCashLoss: state.cumCombatCashLoss,
        turnsSpentTotal: state.turnsSpentTotal,
      });
    }
  }

  return snapshots;
}

export const ARCHETYPE_CONFIGS: ArchetypeConfig[] = [
  {
    id: 'casual',
    label: 'Casual',
    activityRate: 0.3,
    bankSpendBonus: 0,
    payoutPercent: 50,
    primaryScoutArea: 'streets',
    preferredProduceDrug: 'hash',
    attacksPerDay: { min: 0, max: 1 },
    weaponTier: 'glock',
    travelEnabled: false,
    phases: [{ untilDay: 30, allocation: { scout: 0.5, produce: 0.35, combat: 0.05, other: 0.1 } }],
  },
  {
    id: 'balanced',
    label: 'Balanced Active',
    activityRate: 0.65,
    bankSpendBonus: 0.1,
    payoutPercent: 50,
    primaryScoutArea: 'clubs',
    secondaryScoutArea: 'streets',
    preferredProduceDrug: 'mixed',
    attacksPerDay: { min: 1, max: 2 },
    weaponTier: 'mixed',
    travelEnabled: true,
    phases: [
      { untilDay: 7, allocation: { scout: 0.6, produce: 0.25, combat: 0.1, other: 0.05 } },
      { untilDay: 14, allocation: { scout: 0.45, produce: 0.4, combat: 0.1, other: 0.05 } },
      { untilDay: 30, allocation: { scout: 0.3, produce: 0.5, combat: 0.15, other: 0.05 } },
    ],
  },
  {
    id: 'economy',
    label: 'Economy-Focused',
    activityRate: 0.75,
    bankSpendBonus: 0.15,
    payoutPercent: 25,
    primaryScoutArea: 'clubs',
    preferredProduceDrug: 'mixed',
    attacksPerDay: { min: 0, max: 1 },
    weaponTier: 'glock',
    travelEnabled: true,
    phases: [
      { untilDay: 10, allocation: { scout: 0.55, produce: 0.35, combat: 0.05, other: 0.05 } },
      { untilDay: 30, allocation: { scout: 0.35, produce: 0.55, combat: 0.05, other: 0.05 } },
    ],
  },
  {
    id: 'aggressive',
    label: 'Aggressive',
    activityRate: 0.75,
    bankSpendBonus: 0.1,
    payoutPercent: 50,
    primaryScoutArea: 'docks',
    preferredProduceDrug: 'coke',
    attacksPerDay: { min: 3, max: 5 },
    weaponTier: 'uzi',
    travelEnabled: false,
    phases: [{ untilDay: 30, allocation: { scout: 0.4, produce: 0.3, combat: 0.25, other: 0.05 } }],
  },
  {
    id: 'power',
    label: 'Power Player',
    activityRate: 0.95,
    bankSpendBonus: 0.4,
    payoutPercent: 25,
    primaryScoutArea: 'clubs',
    secondaryScoutArea: 'docks',
    preferredProduceDrug: 'mixed',
    attacksPerDay: { min: 2, max: 4 },
    weaponTier: 'mixed',
    travelEnabled: true,
    phases: [
      { untilDay: 7, allocation: { scout: 0.55, produce: 0.3, combat: 0.1, other: 0.05 } },
      { untilDay: 14, allocation: { scout: 0.35, produce: 0.45, combat: 0.15, other: 0.05 } },
      { untilDay: 30, allocation: { scout: 0.25, produce: 0.5, combat: 0.2, other: 0.05 } },
    ],
  },
];

export function percentile(values: number[], p: number): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const idx = Math.floor((p / 100) * (sorted.length - 1));
  return sorted[idx]!;
}

export function summarizeCheckpoints(
  runs: CheckpointSnapshot[][],
  day: number,
): Record<string, { p10: number; median: number; p90: number }> {
  const fields = [
    'prostitutes',
    'thugs',
    'cash',
    'netWorth',
    'hash',
    'coke',
    'heroin',
    'cumScoutCash',
    'cumProduceCash',
    'cumDrugSales',
    'cumSupplySpend',
    'cumWeaponSpend',
    'turnsSpentTotal',
  ] as const;
  const result: Record<string, { p10: number; median: number; p90: number }> = {};
  for (const field of fields) {
    const vals = runs
      .map((r) => r.find((s) => s.day === day)?.[field] ?? 0)
      .filter((v) => Number.isFinite(v));
    result[field] = {
      p10: percentile(vals, 10),
      median: percentile(vals, 50),
      p90: percentile(vals, 90),
    };
  }
  return result;
}

/** Scout-only recovery turns for lost thugs */
export function estimateThugRecoveryTurns(
  thugsLost: number,
  prostitutes: number,
  thugs: number,
  area: ScoutAreaSlug = 'docks',
): number {
  let recovered = 0;
  let turns = 0;
  let seed = 42;
  while (recovered < thugsLost && turns < 50_000) {
    const chunk = Math.min(500, thugsLost * 2);
    const outcome = resolveScouting({
      turnsSpent: chunk,
      districtModifiers: districtModifiers('neon-strip'),
      areaSlug: area,
      prostituteHappiness: 85,
      thugHappiness: 85,
      prostituteCount: prostitutes,
      thugCount: thugs,
      prostitutePayoutPercent: 50,
      seed: seed++,
    });
    recovered += outcome.thugsFound;
    turns += chunk;
  }
  return turns;
}

/** Hire thugs cost analysis */
export function hireThugAnalysis(monthlyIncome: number) {
  const prices = [1500, 2000, 3000, 4000, 5000, 7500, 10_000];
  const counts = [100, 500, 1000];
  return prices.map((price) => ({
    price,
    counts: Object.fromEntries(
      counts.map((n) => [n, { cost: n * price, pctOfIncome: (n * price) / monthlyIncome }]),
    ),
  }));
}
