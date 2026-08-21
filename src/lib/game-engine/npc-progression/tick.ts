import {
  CANONICAL_NET_WORTH_VALUATIONS,
} from '@/lib/game-engine/canonical-net-worth';
import { createSeededRng } from '@/lib/game-engine/rng';
import {
  getCityShopItem,
} from '@/config/game/shop-rules';
import {
  NPC_ARCHETYPE_PROFILES,
  NPC_ARCHETYPE_TICK_PROFILES,
  NPC_PROGRESSION_MAX_CATCHUP_HOURS,
  NPC_PROGRESSION_TICK_HOURS,
  NPC_PROGRESSION_TURNS_PER_TICK,
  NPC_THUGS_PER_RIDE,
  interpolateNpcLadderBand,
  type NpcArchetypeId,
} from '@/config/game/npc-progression-rules';
import {
  canonicalNwForTargetState,
  computeNpcTargetNw,
  type NpcTargetAssetState,
} from '@/lib/game-engine/npc-progression/target-state';

/** Scout / produce rates aligned with round-sim constants (abstract per tick). */
const SCOUT_WORKER_RATE = 0.078;
const SCOUT_THUG_RATE = 0.088;
const PRODUCE_CASH_PER_WORKER = 12;
const PRODUCE_HASH_RATE = 0.012;
const SCOUT_RNG_VARIANCE: [number, number] = [0.65, 1.35];

export interface NpcTickContext {
  state: NpcTargetAssetState;
  archetype: NpcArchetypeId;
  roundDay: number;
  ladderSlot: number;
  growthSeed: number;
  totalSlots: number;
  tickIndex: number;
}

export interface DueTickInput {
  lastProgressedAt: Date | null;
  now?: Date;
  simulateElapsedHours?: number;
  force?: boolean;
}

export function computeDueTickCount(input: DueTickInput): number {
  if (input.force && input.simulateElapsedHours == null) {
    return 1;
  }
  const elapsedHours =
    input.simulateElapsedHours ??
    (input.lastProgressedAt
      ? Math.max(0, ((input.now ?? new Date()).getTime() - input.lastProgressedAt.getTime()) / 3_600_000)
      : NPC_PROGRESSION_TICK_HOURS);

  const cappedHours = Math.min(elapsedHours, NPC_PROGRESSION_MAX_CATCHUP_HOURS);
  return Math.floor(cappedHours / NPC_PROGRESSION_TICK_HOURS);
}

export function applyNpcProgressionTicks(
  initial: NpcTargetAssetState,
  ctx: Omit<NpcTickContext, 'state' | 'tickIndex'>,
  tickCount: number,
  baseTickIndex = 0,
): NpcTargetAssetState {
  let state = cloneAssetState(initial);
  for (let i = 0; i < tickCount; i++) {
    state = applySingleNpcProgressionTick({
      ...ctx,
      state,
      tickIndex: baseTickIndex + i,
    });
  }
  return state;
}

export function applySingleNpcProgressionTick(ctx: NpcTickContext): NpcTargetAssetState {
  const profile = NPC_ARCHETYPE_PROFILES[ctx.archetype];
  const tickProfile = NPC_ARCHETYPE_TICK_PROFILES[ctx.archetype];
  const rng = createSeededRng(ctx.growthSeed + ctx.tickIndex * 48_271 + ctx.roundDay * 997);

  const slotTargetNw = computeNpcTargetNw(
    ctx.roundDay,
    ctx.ladderSlot,
    ctx.growthSeed,
    ctx.totalSlots,
  );
  const currentNw = canonicalNwForTargetState(ctx.state);
  const band = interpolateNpcLadderBand(ctx.roundDay);
  const scaleDamp = 1 / (1 + Math.pow(currentNw / Math.max(band.maxNw, 1), 1.15));

  const periodRoll = rng.next();
  let activityMult =
    periodRoll < 0.18
      ? 0.55 + rng.nextFloat(0, 0.22)
      : periodRoll < 0.78
        ? 0.82 + rng.nextFloat(0, 0.18)
        : 1.02 + rng.nextFloat(0, 0.22);

  const nwRatio = slotTargetNw > 0 ? currentNw / slotTargetNw : 1;
  if (nwRatio < 0.72) activityMult *= 1.12;
  else if (nwRatio < 0.92) activityMult *= 1.04 + (0.92 - nwRatio) * 0.35;
  if (nwRatio > 1.18) activityMult *= 0.88;
  else if (nwRatio > 1.05) activityMult *= 0.94;

  const belowBandBoost = nwRatio < 1 ? Math.min(0.5, (1 - nwRatio) * 0.65) : 0;

  const simulatedTurns =
    NPC_PROGRESSION_TURNS_PER_TICK *
    tickProfile.activityRate *
    activityMult *
    scaleDamp;

  const scoutTurns = simulatedTurns * tickProfile.scoutShare;
  const produceTurns = simulatedTurns * tickProfile.produceShare;
  const poorPeriod = periodRoll < 0.18;

  let scoutWorkers = Math.floor(
    ctx.state.prostitutes *
      SCOUT_WORKER_RATE *
      scoutTurns *
      rng.nextFloat(...SCOUT_RNG_VARIANCE) *
      0.22,
  );
  let scoutThugs = Math.floor(
    ctx.state.thugs *
      SCOUT_THUG_RATE *
      scoutTurns *
      rng.nextFloat(...SCOUT_RNG_VARIANCE) *
      0.22,
  );

  const maxWorkerGain = Math.max(
    0,
    Math.floor((1 + scaleDamp * 8 + ctx.roundDay * 0.12) * (1 + belowBandBoost)),
  );
  const maxThugGain = Math.max(
    0,
    Math.floor((1 + scaleDamp * 5 + ctx.roundDay * 0.08) * (1 + belowBandBoost * 0.85)),
  );
  scoutWorkers = Math.min(scoutWorkers, maxWorkerGain);
  scoutThugs = Math.min(scoutThugs, maxThugGain);

  if (poorPeriod) {
    scoutWorkers = -Math.max(1, Math.floor(maxWorkerGain * rng.nextFloat(0.25, 0.75)));
    scoutThugs = -Math.max(0, Math.floor(maxThugGain * rng.nextFloat(0.2, 0.6)));
  }

  let produceCash = Math.floor(
    ctx.state.prostitutes *
      PRODUCE_CASH_PER_WORKER *
      produceTurns *
      0.05 *
      rng.nextFloat(0.7, 1.3),
  );
  produceCash = Math.min(
    produceCash,
    Math.floor(currentNw * (0.012 + belowBandBoost * 0.018) * activityMult),
  );
  const drugUnits = Math.min(
    Math.floor(ctx.state.prostitutes * PRODUCE_HASH_RATE * produceTurns * rng.nextFloat(0.5, 1.2)),
    Math.max(20, Math.floor(currentNw / CANONICAL_NET_WORTH_VALUATIONS.drugUnit / 20)),
  );

  const setback = rng.next() < 0.22;
  const setbackSeverity = setback
    ? rng.nextFloat(0.03, 0.09) * tickProfile.setbackVolatility
    : 0;

  const operatingExpense = Math.floor(
    Math.max(500, currentNw * 0.0025) * rng.nextFloat(0.85, 1.35) * (0.85 + profile.thugLean * 0.35),
  );
  const overscaleTax =
    nwRatio > 1.12 ? Math.floor(currentNw * 0.0015 * (nwRatio - 1) * rng.nextFloat(0.8, 1.2)) : 0;

  let cash = ctx.state.cash + produceCash - operatingExpense - overscaleTax;
  let bankCash = ctx.state.bankCash;
  let prostitutes = ctx.state.prostitutes + scoutWorkers;
  let thugs = ctx.state.thugs + scoutThugs;

  if (setback) {
    cash = Math.floor(cash * (1 - setbackSeverity));
    prostitutes = Math.max(profile.minWorkers, Math.floor(prostitutes * (1 - setbackSeverity * 0.45)));
    thugs = Math.max(profile.minThugs, Math.floor(thugs * (1 - setbackSeverity * 0.35)));
  }

  const bankThreshold = Math.max(
    25_000,
    Math.floor(slotTargetNw * profile.cashFraction * tickProfile.bankThresholdMult),
  );
  if (cash > bankThreshold) {
    const deposit = Math.floor((cash - bankThreshold * 0.5) * 0.28);
    if (deposit > 0) {
      cash -= deposit;
      bankCash += deposit;
    }
  }

  let rides = ctx.state.rides;
  const ridePrice = getCityShopItem('ride')?.shopPrice ?? 2500;
  const neededRides = Math.max(1, Math.ceil(thugs / NPC_THUGS_PER_RIDE));
  while (rides < neededRides && cash >= ridePrice) {
    cash -= ridePrice;
    rides++;
  }

  let { glocks, uzis, aks } = ctx.state;
  const glockPrice = getCityShopItem('glock')?.shopPrice ?? 500;
  const uziPrice = getCityShopItem('uzi')?.shopPrice ?? 1500;
  const akPrice = getCityShopItem('ak')?.shopPrice ?? 3800;
  const militaryBudget = Math.floor(cash * tickProfile.militarySpend * rng.nextFloat(0.4, 1));
  let militarySpend = 0;

  const targetGlocks = Math.min(thugs, Math.max(1, Math.floor(thugs * profile.glockCoverage)));
  const targetUzis = Math.min(Math.max(0, thugs - glocks), Math.floor(thugs * profile.uziCoverage));
  const targetAks = Math.min(Math.max(0, thugs - glocks - uzis), Math.floor(thugs * profile.akCoverage));

  while (glocks < targetGlocks && militarySpend + glockPrice <= militaryBudget && cash >= glockPrice) {
    cash -= glockPrice;
    glocks++;
    militarySpend += glockPrice;
  }
  while (uzis < glocks + targetUzis && militarySpend + uziPrice <= militaryBudget && cash >= uziPrice) {
    cash -= uziPrice;
    uzis++;
    militarySpend += uziPrice;
  }
  while (aks < glocks + uzis + targetAks && militarySpend + akPrice <= militaryBudget && cash >= akPrice) {
    cash -= akPrice;
    aks++;
    militarySpend += akPrice;
  }

  let { hash, shrooms, coke, heroin } = ctx.state;
  hash += Math.floor(drugUnits * 0.42);
  coke += Math.floor(drugUnits * 0.22);
  shrooms += Math.floor(drugUnits * 0.18);
  heroin += Math.max(0, drugUnits - Math.floor(drugUnits * 0.82));

  if (setback && rng.next() < 0.55) {
    hash = Math.floor(hash * (1 - setbackSeverity * 0.8));
    coke = Math.floor(coke * (1 - setbackSeverity * 0.65));
    shrooms = Math.floor(shrooms * (1 - setbackSeverity * 0.5));
  }

  const maxDrugUnits = Math.max(400, Math.floor(currentNw / CANONICAL_NET_WORTH_VALUATIONS.drugUnit / 2));
  const totalDrugs = hash + shrooms + coke + heroin;
  if (totalDrugs > maxDrugUnits) {
    const ratio = maxDrugUnits / totalDrugs;
    hash = Math.floor(hash * ratio);
    shrooms = Math.floor(shrooms * ratio);
    coke = Math.floor(coke * ratio);
    heroin = Math.floor(heroin * ratio);
  }

  const beerPrice = getCityShopItem('beer')?.shopPrice ?? 4;
  const condomPrice = getCityShopItem('condom')?.shopPrice ?? 2;
  const targetBeer = Math.max(thugs * 2, ctx.state.beer);
  const targetCondoms = Math.max(prostitutes * 2, ctx.state.condoms);
  const supplyCost =
    Math.max(0, targetBeer - ctx.state.beer) * beerPrice +
    Math.max(0, targetCondoms - ctx.state.condoms) * condomPrice;
  cash = Math.max(0, cash - supplyCost);

  prostitutes = Math.max(profile.minWorkers, prostitutes);
  thugs = Math.max(profile.minThugs, thugs);
  rides = Math.max(rides, Math.ceil(thugs / NPC_THUGS_PER_RIDE));
  cash = Math.max(0, Math.floor(cash));
  bankCash = Math.max(0, Math.floor(bankCash));

  const draft: NpcTargetAssetState = {
    ...ctx.state,
    cash,
    bankCash,
    prostitutes,
    thugs,
    rides,
    glocks,
    uzis,
    aks,
    beer: targetBeer,
    condoms: targetCondoms,
    hash,
    shrooms,
    coke,
    heroin,
  };

  return clampTickNetWorthDelta(ctx.state, draft, {
    maxUpPct: 0.035 + scaleDamp * 0.03 + belowBandBoost * 0.04,
    maxDownPct: 0.055 + tickProfile.setbackVolatility * 0.015 + (nwRatio > 1.05 ? 0.02 : 0),
  });
}

function clampTickNetWorthDelta(
  before: NpcTargetAssetState,
  after: NpcTargetAssetState,
  bounds: { maxUpPct: number; maxDownPct: number },
): NpcTargetAssetState {
  const nwBefore = canonicalNwForTargetState(before);
  const nwAfter = canonicalNwForTargetState(after);
  if (nwBefore <= 0) return after;

  const maxUp = nwBefore * bounds.maxUpPct;
  const maxDown = nwBefore * bounds.maxDownPct;
  if (nwAfter <= nwBefore + maxUp && nwAfter >= nwBefore - maxDown) return after;

  const targetNw =
    nwAfter > nwBefore + maxUp
      ? nwBefore + maxUp
      : Math.max(0, nwBefore - maxDown);
  const ratio = nwAfter > 0 ? targetNw / nwAfter : 1;
  return scaleAssetState(after, ratio);
}

function scaleAssetState(state: NpcTargetAssetState, ratio: number): NpcTargetAssetState {
  return {
    ...state,
    cash: Math.max(0, Math.floor(state.cash * ratio)),
    bankCash: Math.max(0, Math.floor(state.bankCash * ratio)),
    prostitutes: Math.max(1, Math.floor(state.prostitutes * ratio)),
    thugs: Math.max(1, Math.floor(state.thugs * ratio)),
    rides: Math.max(1, Math.floor(state.rides * ratio)),
    hash: Math.floor(state.hash * ratio),
    shrooms: Math.floor(state.shrooms * ratio),
    coke: Math.floor(state.coke * ratio),
    heroin: Math.floor(state.heroin * ratio),
    businesses: state.businesses.map((b) => ({
      ...b,
      assignedWorkers: Math.floor(b.assignedWorkers * ratio),
      assignedThugs: Math.floor(b.assignedThugs * ratio),
    })),
  };
}

function cloneAssetState(state: NpcTargetAssetState): NpcTargetAssetState {
  return {
    ...state,
    businesses: state.businesses.map((b) => ({ ...b })),
  };
}
