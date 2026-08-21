import type { AttackType } from '../../../src/config/game/attack-rules';
import { ATTACK_RULES } from '../../../src/config/game/attack-rules';
import { isWithinAttackRange } from '../../../src/config/game/redlite-rules';
import {
  businessPurchasePrice,
  getBusinessInvestedValue,
  getBusinessLevelStats,
  MAX_BUSINESSES_PER_PLAYER,
  type BusinessType,
} from '../../../src/config/game/business-rules';
import { calculateEmpireRecruitmentMultipliers } from '../../../src/config/game/empire-recruitment-rules';
import { THUG_HIRE_PRICE } from '../../../src/config/game/hire-thugs-rules';
import { settleBusinessIncome } from '../../../src/lib/game-engine/business/settlement';
import { calculateCanonicalNetWorthFromPlayer } from '../../../src/lib/game-engine/canonical-net-worth';
import { resolveCombat, deriveCombatSeed } from '../../../src/lib/game-engine/combat/resolve-combat';
import {
  calculateProstituteHappiness,
  calculateThugHappiness,
} from '../../../src/lib/game-engine/happiness';
import type { ProductionDrug } from '../../../src/lib/game-engine/production';
import { resolveProduction } from '../../../src/lib/game-engine/production';
import { resolveScouting } from '../../../src/lib/game-engine/scouting';
import { resolveSupplyConsumptionForAction } from '../../../src/lib/game-engine/supply-consumption';
import { TURNS_CONFIG, DISTRICTS, PRODUCTION_CONFIG } from '../../../src/config/game/balance';
import { getDrugStreetPrice, type StreetDrugType } from '../../../src/config/game/drug-street-prices';
import { getCityShopItem } from '../../../src/config/game/shop-rules';
import { REDLITE_TRAVEL } from '../../../src/config/game/redlite-rules';
import type { DistrictSlug } from '../../../src/config/game/scout-area-names';
import {
  createInitialState,
  TURNS_PER_DAY,
  type SimState,
  type ScoutAreaSlug,
} from '../monthly-sim/engine';
import type { HypotheticalOverrides } from './constants';
import {
  assignProfiles,
  buildPlayerProfile,
  DISTRICTS_FOR_SIM,
  type ActivityLevel,
  type PlayerProfile,
  type StrategyArchetype,
} from './profiles';

export const CHECKPOINTS_7 = [1, 3, 5, 7] as const;
export const CHECKPOINTS_30 = [1, 3, 7, 14, 21, 30] as const;

export interface SimBusiness {
  businessType: BusinessType;
  level: number;
  assignedWorkers: number;
  assignedSecurity: number;
  safeCash: number;
  lastSettledMs: number;
  invested: number;
}

export interface DailyMetrics {
  day: number;
  netWorth: number;
  cash: number;
  bankCash: number;
  workers: number;
  thugs: number;
  rides: number;
  turns: number;
  turnsSpent: number;
  turnsWasted: number;
  businesses: number;
  businessSafeCash: number;
  attacksLaunched: number;
  attacksSucceeded: number;
  pvpCashNet: number;
  scoutCash: number;
  produceCash: number;
  businessIncomeCollected: number;
}

export interface SimPlayerResult {
  id: number;
  profile: PlayerProfile;
  district: DistrictSlug;
  daily: DailyMetrics[];
  totals: {
    turnsGenerated: number;
    turnsSpent: number;
    turnsWasted: number;
    scoutCash: number;
    produceCash: number;
    drugSales: number;
    shopSpend: number;
    intelTurns: number;
    attackTurns: number;
    travelTurns: number;
    pvpCashGained: number;
    pvpCashLost: number;
    pvpThugsLost: number;
    businessPurchases: number;
    businessIncomeCollected: number;
    bankDeposited: number;
    attacksLaunched: number;
    attacksSucceeded: number;
  };
}

export interface RoundSimOptions {
  days: number;
  playerCount: number;
  seed: number;
  overrides?: HypotheticalOverrides;
}

function districtModifiers(slug: DistrictSlug) {
  return DISTRICTS.find((d) => d.slug === slug)!.modifiers;
}

function shopPrice(key: string): number {
  return getCityShopItem(key as 'hash')!.shopPrice;
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

function businessContext(state: SimState, businesses: SimBusiness[]) {
  const assignedWorkers = businesses.reduce((s, b) => s + b.assignedWorkers, 0);
  const assignedSecurity = businesses.reduce((s, b) => s + b.assignedSecurity, 0);
  const businessStreetAssets = businesses.reduce((s, b) => s + Math.floor(b.invested * 0.5), 0);
  return {
    streetWorkers: state.prostitutes,
    assignedWorkers,
    assignedSecurityThugs: assignedSecurity,
    businessStreetAssets,
  };
}

function nw(state: SimState, businesses: SimBusiness[]): number {
  return calculateCanonicalNetWorthFromPlayer(
    {
      cash: state.cash,
      bankCash: state.bankCash,
      thugs: state.thugs,
      prostitutes: state.prostitutes,
      rides: state.rides,
      hash: state.hash,
      shrooms: state.shrooms,
      coke: state.coke,
      heroin: state.heroin,
    },
    businessContext(state, businesses),
  );
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

function pickProduceDrug(state: SimState, pref: ProductionDrug | 'mixed'): ProductionDrug {
  if (pref !== 'mixed') return pref;
  const prices = {
    coke: getDrugStreetPrice(state.district, 'coke'),
    heroin: getDrugStreetPrice(state.district, 'heroin'),
  };
  return prices.heroin >= prices.coke ? 'heroin' : 'coke';
}

function pickAttackType(profile: PlayerProfile, rng: number): AttackType {
  const weights = profile.attackTypeWeights;
  const entries = Object.entries(weights) as [AttackType, number][];
  const total = entries.reduce((s, [, w]) => s + w, 0);
  let roll = rng % total;
  for (const [type, w] of entries) {
    roll -= w;
    if (roll < 0) return type;
  }
  return 'HOME_INVASION';
}

function attackTurnCost(type: AttackType, overrides?: HypotheticalOverrides): number {
  const base = ATTACK_RULES.turnCosts[type];
  const mult = overrides?.attackTurnCostMultiplier ?? 1;
  return Math.max(1, Math.round(base * mult));
}

class Rng {
  private state: number;
  constructor(seed: number) {
    this.state = seed >>> 0;
  }
  next(): number {
    this.state = (this.state * 1664525 + 1013904223) >>> 0;
    return this.state;
  }
  float(): number {
    return this.next() / 0xffffffff;
  }
  range(min: number, max: number): number {
    if (max <= min) return min;
    return min + (this.next() % (max - min + 1));
  }
}

interface PlayerSim {
  id: number;
  profile: PlayerProfile;
  district: DistrictSlug;
  state: SimState;
  businesses: SimBusiness[];
  totals: SimPlayerResult['totals'];
  daily: DailyMetrics[];
  simStartMs: number;
}

function settleAllBusinesses(player: PlayerSim, dayMs: number): number {
  let collected = 0;
  const nowMs = player.simStartMs + dayMs;
  for (const biz of player.businesses) {
    const result = settleBusinessIncome({
      businessType: biz.businessType,
      level: biz.level,
      assignedWorkers: biz.assignedWorkers,
      safeCash: biz.safeCash,
      lastSettledAt: new Date(biz.lastSettledMs),
      now: new Date(nowMs),
    });
    biz.safeCash = result.safeCash;
    biz.lastSettledMs = result.lastSettledAt.getTime();
  }
  if (
    player.profile.strategy === 'ECONOMY' ||
    (player.profile.strategy === 'BALANCED' && player.profile.activity !== 'CASUAL')
  ) {
    for (const biz of player.businesses) {
      const stats = getBusinessLevelStats(biz.businessType, biz.level);
      if (biz.safeCash >= stats.safeCapacity * 0.55) {
        const take = Math.floor(biz.safeCash * 0.7);
        biz.safeCash -= take;
        player.state.cash += take;
        collected += take;
        player.totals.businessIncomeCollected += take;
      }
    }
  }
  return collected;
}

function assignBusinessStaff(player: PlayerSim): void {
  let available = player.state.prostitutes;
  for (const biz of player.businesses) {
    const cap = getBusinessLevelStats(biz.businessType, biz.level).workerCapacity;
    const assign = Math.min(available, cap);
    biz.assignedWorkers = assign;
    available -= assign;
  }
  player.state.prostitutes = available;
}

function tryBuyBusiness(player: PlayerSim, rng: Rng): void {
  if (player.profile.businessPriority === 'none') return;
  if (player.businesses.length >= MAX_BUSINESSES_PER_PLAYER) return;
  const reserve = player.state.cash * player.profile.reserveCashFraction;
  const spendable = player.state.cash - reserve;
  const order: BusinessType[] =
    player.profile.businessPriority === 'worker'
      ? ['WAREHOUSE', 'NIGHTCLUB', 'DRUG_LAB']
      : player.profile.businessPriority === 'thug'
        ? ['DRUG_LAB', 'NIGHTCLUB', 'WAREHOUSE']
        : ['NIGHTCLUB', 'WAREHOUSE', 'DRUG_LAB'];
  for (const type of order) {
    const price = businessPurchasePrice(type);
    if (spendable >= price * 1.05) {
      player.state.cash -= price;
      player.totals.businessPurchases += price;
      player.businesses.push({
        businessType: type,
        level: 1,
        assignedWorkers: 0,
        assignedSecurity: 0,
        safeCash: 0,
        lastSettledMs: player.simStartMs,
        invested: price,
      });
      assignBusinessStaff(player);
      return;
    }
  }
}

function maybeBank(player: PlayerSim): void {
  const { state, profile } = player;
  if (state.cash < profile.bankDepositThreshold) return;
  const retain = Math.floor(state.cash * profile.bankRetainFraction);
  const deposit = state.cash - retain;
  if (deposit <= 0) return;
  state.bankCash += deposit;
  state.cash -= deposit;
  player.totals.bankDeposited += deposit;
}

function doScout(
  player: PlayerSim,
  turns: number,
  area: ScoutAreaSlug,
  seed: number,
  overrides?: HypotheticalOverrides,
): number {
  const { state, businesses } = player;
  if (turns <= 0 || state.turns < turns) return 0;
  const m = morale(state);
  const assignedWorkers = businesses.reduce((s, b) => s + b.assignedWorkers, 0);
  const recruitment = calculateEmpireRecruitmentMultipliers({
    businesses: businesses.map((b) => ({ businessType: b.businessType, level: b.level })),
    workers: state.prostitutes + assignedWorkers,
    thugs: state.thugs,
    assignedWorkers,
  });
  let workerMult = recruitment.workerMultiplier;
  let thugMult = recruitment.thugMultiplier;
  if (overrides?.scoutWorkerRateMultiplier) {
    workerMult *= overrides.scoutWorkerRateMultiplier;
  }
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
    businessNetwork: {
      workerMultiplier: workerMult,
      thugMultiplier: thugMult,
      workerBonusPercent: recruitment.workerBonusPercent,
      thugBonusPercent: recruitment.thugBonusPercent,
    },
  });
  applySupply(state, turns);
  state.turns -= turns;
  player.totals.turnsSpent += turns;
  state.prostitutes = Math.max(0, state.prostitutes + outcome.prostitutesFound - outcome.prostitutesLost);
  state.thugs = Math.max(0, state.thugs + outcome.thugsFound - outcome.thugsLost);
  state.cash += outcome.cashEarned;
  player.totals.scoutCash += outcome.cashEarned;
  return outcome.cashEarned;
}

function doProduce(player: PlayerSim, turns: number, drug: ProductionDrug, seed: number): number {
  const { state } = player;
  if (turns <= 0 || state.turns < turns) return 0;
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
  player.totals.turnsSpent += turns;
  state.prostitutes = Math.max(0, state.prostitutes - outcome.prostitutesLost);
  state.thugs = Math.max(0, state.thugs - outcome.thugsLost);
  state.cash += outcome.cashEarned;
  player.totals.produceCash += outcome.cashEarned;
  if (drug === 'hash') state.hash += outcome.drugUnitsProduced;
  else state[drug] += outcome.drugUnitsProduced;
  return outcome.cashEarned;
}

function sellDrugs(player: PlayerSim, fraction: number): void {
  const drugs: StreetDrugType[] = ['heroin', 'coke', 'shrooms'];
  for (const drug of drugs) {
    const qty = player.state[drug];
    const toSell = Math.floor(qty * fraction);
    if (toSell <= 0) continue;
    player.state[drug] -= toSell;
    const revenue = toSell * getDrugStreetPrice(player.state.district, drug);
    player.state.cash += revenue;
    player.totals.drugSales += revenue;
  }
}

function restock(player: PlayerSim): void {
  const s = player.state;
  const buy = (field: 'hash' | 'condoms' | 'beer', key: string, target: number) => {
    const need = Math.max(0, target - s[field]);
    if (need <= 0) return;
    const price = shopPrice(key);
    const affordable = Math.min(need, Math.floor(s.cash / price));
    if (affordable <= 0) return;
    s[field] += affordable;
    s.cash -= affordable * price;
    player.totals.shopSpend += affordable * price;
  };
  buy('condoms', 'condom', Math.max(s.prostitutes * 4, 20));
  buy('beer', 'beer', Math.max(s.thugs * 2, 10));
  buy('hash', 'hash', Math.max(s.prostitutes * 2, 20));
}

function maintainGear(player: PlayerSim): void {
  const s = player.state;
  const target = Math.max(s.thugs, 1);
  const needGlocks = Math.max(0, target - s.glocks - s.uzis - s.aks);
  if (needGlocks > 0 && s.cash >= needGlocks * shopPrice('glock')) {
    s.glocks += needGlocks;
    s.cash -= needGlocks * shopPrice('glock');
    player.totals.shopSpend += needGlocks * shopPrice('glock');
  }
  const ridesNeeded = Math.max(1, Math.ceil((s.prostitutes + s.thugs) / REDLITE_TRAVEL.crewPerRide));
  const buyRides = Math.max(0, ridesNeeded - s.rides);
  if (buyRides > 0 && s.cash >= buyRides * shopPrice('ride')) {
    s.rides += buyRides;
    s.cash -= buyRides * shopPrice('ride');
    player.totals.shopSpend += buyRides * shopPrice('ride');
  }
}

function simulateDay(
  players: PlayerSim[],
  day: number,
  rng: Rng,
  overrides?: HypotheticalOverrides,
): void {
  const regenMult = overrides?.turnRegenMultiplier ?? 1;
  const dayMs = day * 86_400_000;

  for (const player of players) {
    const before = player.state.turns;
    const regen = Math.floor(TURNS_PER_DAY * regenMult);
    player.state.turns = Math.min(TURNS_CONFIG.turnCap, player.state.turns + regen);
    player.totals.turnsGenerated += regen;
    const wasted = Math.max(0, before + regen - TURNS_CONFIG.turnCap);
    player.totals.turnsWasted += wasted;

    settleAllBusinesses(player, dayMs);
    assignBusinessStaff(player);

    const profile = player.profile;
    const inefficiencyLoss =
      profile.inefficiency > 0 ? Math.floor(rng.float() * profile.inefficiency * 40) : 0;
    let budget = Math.floor(
      Math.min(player.state.turns, TURNS_PER_DAY * profile.activityRate) - inefficiencyLoss,
    );
    budget = Math.max(0, budget);

    const area = day <= 7 ? profile.primaryScoutArea : profile.secondaryScoutArea;
    const scoutTurns = Math.floor(budget * profile.scoutShare);
    const produceTurns = Math.floor(budget * profile.produceShare);
    budget -= scoutTurns + produceTurns;

    if (scoutTurns > 0) doScout(player, scoutTurns, area, rng.next(), overrides);
    if (produceTurns > 0) {
      const drug = pickProduceDrug(player.state, profile.preferredProduceDrug);
      doProduce(player, produceTurns, drug, rng.next());
    }

    tryBuyBusiness(player, rng);
    maybeBank(player);
    sellDrugs(player, profile.strategy === 'ECONOMY' ? 0.3 : 0.12);
    restock(player);
    maintainGear(player);

    const dayStartAttacks = player.totals.attacksLaunched;
    const dayStartPvp = player.totals.pvpCashGained - player.totals.pvpCashLost;

    const attackCount = rng.range(profile.attacksPerDay.min, profile.attacksPerDay.max);
    for (let a = 0; a < attackCount && player.state.thugs >= 10; a++) {
      const candidates = players.filter(
        (p) =>
          p.id !== player.id &&
          p.district === player.district &&
          isWithinAttackRange(nw(player.state, player.businesses), nw(p.state, p.businesses)),
      );
      if (candidates.length === 0) break;
      const defender = candidates[rng.next() % candidates.length]!;
      const intelCost = ATTACK_RULES.scoutIntelTurnCost;
      if (player.state.turns < intelCost + 5) break;
      player.state.turns -= intelCost;
      player.totals.intelTurns += intelCost;
      player.totals.turnsSpent += intelCost;

      const attackType = pickAttackType(profile, rng.next());
      const turnCost = attackTurnCost(attackType, overrides);
      if (player.state.turns < turnCost) break;

      const send = Math.min(player.state.thugs, Math.max(10, Math.floor(player.state.thugs * 0.2)));
      const atk = player.state;
      const def = defender.state;
      const result = resolveCombat({
        attackType,
        attackingThugs: send,
        attacker: {
          thugs: atk.thugs,
          glocks: atk.glocks,
          uzis: atk.uzis,
          aks: atk.aks,
          cash: atk.cash,
          drugs: { hash: atk.hash, shrooms: atk.shrooms, coke: atk.coke, heroin: atk.heroin },
        },
        defender: {
          thugs: def.thugs,
          glocks: def.glocks,
          uzis: def.uzis,
          aks: def.aks,
          cash: def.cash,
          drugs: { hash: def.hash, shrooms: def.shrooms, coke: def.coke, heroin: def.heroin },
        },
        poachContext:
          attackType === 'POACH_WORKERS'
            ? {
                defenderWorkers: def.prostitutes,
                defenderThugsForProtection: def.thugs,
                workerHappiness: morale(def).worker,
              }
            : undefined,
        seed: deriveCombatSeed(String(player.id), String(defender.id), `${day}-${a}`),
      });

      atk.turns -= turnCost;
      player.totals.attackTurns += turnCost;
      player.totals.turnsSpent += turnCost;
      player.totals.attacksLaunched += 1;

      atk.thugs = Math.max(0, atk.thugs - result.attackerLosses);
      def.thugs = Math.max(0, def.thugs - result.defenderLosses);
      atk.glocks = Math.max(0, atk.glocks - result.attackerWeaponLosses.glocks);
      atk.uzis = Math.max(0, atk.uzis - result.attackerWeaponLosses.uzis);
      atk.aks = Math.max(0, atk.aks - result.attackerWeaponLosses.aks);

      player.totals.pvpThugsLost += result.attackerLosses;
      defender.totals.pvpThugsLost += result.defenderLosses;

      if (result.cashStolen > 0) {
        const stolen = Math.min(def.cash, result.cashStolen);
        def.cash -= stolen;
        atk.cash += stolen;
        player.totals.pvpCashGained += stolen;
        defender.totals.pvpCashLost += stolen;
      }
      if (result.workersStolen > 0) {
        const ws = Math.min(def.prostitutes, result.workersStolen);
        def.prostitutes -= ws;
        atk.prostitutes += ws;
      }
      const drugVal =
        (result.drugsStolen.hash +
          result.drugsStolen.shrooms +
          result.drugsStolen.coke +
          result.drugsStolen.heroin) *
        5;
      if (drugVal > 0) {
        atk.hash += result.drugsStolen.hash;
        atk.shrooms += result.drugsStolen.shrooms;
        atk.coke += result.drugsStolen.coke;
        atk.heroin += result.drugsStolen.heroin;
        def.hash = Math.max(0, def.hash - result.drugsStolen.hash);
        def.shrooms = Math.max(0, def.shrooms - result.drugsStolen.shrooms);
        def.coke = Math.max(0, def.coke - result.drugsStolen.coke);
        def.heroin = Math.max(0, def.heroin - result.drugsStolen.heroin);
        player.totals.pvpCashGained += drugVal;
        defender.totals.pvpCashLost += drugVal;
      }
      if (result.outcome === 'SUCCESS') player.totals.attacksSucceeded += 1;
    }

    assignBusinessStaff(player);

    const assignedWorkers = player.businesses.reduce((s, b) => s + b.assignedWorkers, 0);
    player.daily.push({
      day,
      netWorth: nw(player.state, player.businesses),
      cash: player.state.cash,
      bankCash: player.state.bankCash,
      workers: player.state.prostitutes + assignedWorkers,
      thugs: player.state.thugs,
      rides: player.state.rides,
      turns: player.state.turns,
      turnsSpent: player.totals.turnsSpent,
      turnsWasted: player.totals.turnsWasted,
      businesses: player.businesses.length,
      businessSafeCash: player.businesses.reduce((s, b) => s + b.safeCash, 0),
      attacksLaunched: player.totals.attacksLaunched - dayStartAttacks,
      attacksSucceeded: 0,
      pvpCashNet: player.totals.pvpCashGained - player.totals.pvpCashLost - dayStartPvp,
      scoutCash: player.totals.scoutCash,
      produceCash: player.totals.produceCash,
      businessIncomeCollected: player.totals.businessIncomeCollected,
    });
  }
}

export function runRoundSimulation(options: RoundSimOptions): SimPlayerResult[] {
  const { days, playerCount, seed, overrides } = options;
  const rng = new Rng(seed);
  const profiles = assignProfiles(playerCount, seed);

  const players: PlayerSim[] = profiles.map((profile, id) => ({
    id,
    profile,
    district: DISTRICTS_FOR_SIM[id % DISTRICTS_FOR_SIM.length]!,
    state: createInitialState(DISTRICTS_FOR_SIM[id % DISTRICTS_FOR_SIM.length]!),
    businesses: [],
    simStartMs: 0,
    daily: [],
    totals: {
      turnsGenerated: 0,
      turnsSpent: 0,
      turnsWasted: 0,
      scoutCash: 0,
      produceCash: 0,
      drugSales: 0,
      shopSpend: 0,
      intelTurns: 0,
      attackTurns: 0,
      travelTurns: 0,
      pvpCashGained: 0,
      pvpCashLost: 0,
      pvpThugsLost: 0,
      businessPurchases: 0,
      businessIncomeCollected: 0,
      bankDeposited: 0,
      attacksLaunched: 0,
      attacksSucceeded: 0,
    },
  }));

  for (const p of players) {
    p.state.prostitutePayoutPercent = p.profile.payoutPercent;
  }

  for (let day = 1; day <= days; day++) {
    simulateDay(players, day, rng, overrides);
  }

  return players.map((p) => ({
    id: p.id,
    profile: p.profile,
    district: p.district,
    daily: p.daily,
    totals: p.totals,
  }));
}

export function recoveryScenario(
  type: 'moderate' | 'major' | 'cash_theft' | 'crew_loss',
  profile: PlayerProfile = buildPlayerProfile('REGULAR', 'BALANCED'),
): { daysToRecover: number; turnsToRecover: number } {
  const rng = new Rng(42);
  const player: PlayerSim = {
    id: 0,
    profile,
    district: 'neon-strip',
    state: createInitialState('neon-strip'),
    businesses: [],
    simStartMs: 0,
    daily: [],
    totals: {
      turnsGenerated: 0,
      turnsSpent: 0,
      turnsWasted: 0,
      scoutCash: 0,
      produceCash: 0,
      drugSales: 0,
      shopSpend: 0,
      intelTurns: 0,
      attackTurns: 0,
      travelTurns: 0,
      pvpCashGained: 0,
      pvpCashLost: 0,
      pvpThugsLost: 0,
      businessPurchases: 0,
      businessIncomeCollected: 0,
      bankDeposited: 0,
      attacksLaunched: 0,
      attacksSucceeded: 0,
    },
  };
  for (let d = 1; d <= 14; d++) simulateDay([player], d, rng);
  const baselineNw = nw(player.state, player.businesses);

  if (type === 'moderate') {
    player.state.thugs = Math.max(1, Math.floor(player.state.thugs * 0.75));
    player.state.cash = Math.floor(player.state.cash * 0.85);
  } else if (type === 'major') {
    player.state.thugs = Math.max(1, Math.floor(player.state.thugs * 0.45));
    player.state.cash = Math.floor(player.state.cash * 0.55);
    player.state.prostitutes = Math.max(1, Math.floor(player.state.prostitutes * 0.8));
  } else if (type === 'cash_theft') {
    player.state.cash = Math.floor(player.state.cash * 0.25);
  } else {
    player.state.thugs = Math.max(1, Math.floor(player.state.thugs * 0.35));
  }

  let days = 0;
  let turnsAtRecovery = 0;
  while (days < 30) {
    days++;
    simulateDay([player], 14 + days, rng);
    if (nw(player.state, player.businesses) >= baselineNw) {
      turnsAtRecovery = player.totals.turnsSpent;
      break;
    }
  }
  return { daysToRecover: days, turnsToRecover: turnsAtRecovery };
}

export type { ActivityLevel, StrategyArchetype, PlayerProfile };
