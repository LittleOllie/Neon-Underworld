import type { BusinessType } from '@prisma/client';
import {
  CANONICAL_NET_WORTH_VALUATIONS,
  calculateCanonicalNetWorthFromPlayer,
  type CanonicalNetWorthBusinessContext,
} from '@/lib/game-engine/canonical-net-worth';
import {
  getBusinessStreetNwAssetForState,
  businessPurchasePrice,
} from '@/config/game/business-rules';
import { getBusinessLevelStats } from '@/config/game/business-levels';
import {
  NPC_ARCHETYPE_PROFILES,
  NPC_THUGS_PER_RIDE,
  interpolateNpcLadderBand,
  type NpcArchetypeId,
  type NpcBusinessPlan,
} from '@/config/game/npc-progression-rules';
import { createSeededRng } from '@/lib/game-engine/rng';

export interface NpcTargetAssetState {
  cash: number;
  bankCash: number;
  prostitutes: number;
  thugs: number;
  rides: number;
  glocks: number;
  uzis: number;
  aks: number;
  beer: number;
  condoms: number;
  hash: number;
  shrooms: number;
  coke: number;
  heroin: number;
  businesses: NpcBusinessPlan[];
}

function planBusinesses(
  archetype: NpcArchetypeId,
  roundDay: number,
  growthSeed: number,
): NpcBusinessPlan[] {
  const profile = NPC_ARCHETYPE_PROFILES[archetype];
  if (profile.businessTier <= 0) return [];

  const unlockDayByTier: Record<number, number> = { 1: 5, 2: 10, 3: 15 };
  const unlockDay = unlockDayByTier[profile.businessTier] ?? 99;
  if (roundDay < unlockDay) return [];

  const rng = createSeededRng(growthSeed + roundDay * 31337);
  const maxLevel = Math.min(5, 1 + Math.floor((roundDay - unlockDay) / 7));
  const countByTier: Record<number, number> = {
    1: 1,
    2: roundDay >= 15 ? 2 : 1,
    3: Math.min(4, 1 + Math.floor((roundDay - unlockDay) / 8)),
  };
  const count = countByTier[profile.businessTier] ?? 0;

  const types: BusinessType[] = ['WAREHOUSE', 'NIGHTCLUB', 'DRUG_LAB'];
  const plans: NpcBusinessPlan[] = [];

  for (let i = 0; i < count; i++) {
    const businessType = types[(i + growthSeed) % types.length]!;
    const level = Math.max(1, Math.min(maxLevel, 1 + Math.floor(rng.nextFloat(0, maxLevel))));
    const stats = getBusinessLevelStats(businessType, level);
    const workerFill = 0.55 + rng.nextFloat(0, 0.35);
    const thugFill = archetype === 'ENFORCER' || archetype === 'SYNDICATE_BOSS'
      ? 0.35 + rng.nextFloat(0, 0.4)
      : 0.1 + rng.nextFloat(0, 0.25);
    plans.push({
      businessType,
      level,
      assignedWorkers: Math.floor(stats.workerCapacity * workerFill),
      assignedThugs: Math.floor(stats.securityCapacity * thugFill),
    });
  }

  return plans;
}

function businessNwContext(businesses: NpcBusinessPlan[]): CanonicalNetWorthBusinessContext {
  let assignedWorkers = 0;
  let assignedSecurityThugs = 0;
  let businessStreetAssets = 0;
  for (const b of businesses) {
    assignedWorkers += b.assignedWorkers;
    assignedSecurityThugs += b.assignedThugs;
    businessStreetAssets += getBusinessStreetNwAssetForState({
      businessType: b.businessType,
      level: b.level,
    });
  }
  return {
    streetWorkers: 0,
    assignedWorkers,
    assignedSecurityThugs,
    businessStreetAssets,
  };
}

function nwForState(street: Omit<NpcTargetAssetState, 'businesses'>, businesses: NpcBusinessPlan[]): number {
  const biz = businessNwContext(businesses);
  return calculateCanonicalNetWorthFromPlayer(
    {
      cash: street.cash,
      bankCash: street.bankCash,
      thugs: street.thugs,
      prostitutes: street.prostitutes,
      rides: street.rides,
      hash: street.hash,
      shrooms: street.shrooms,
      coke: street.coke,
      heroin: street.heroin,
    },
    biz,
  );
}

export function computeNpcTargetNw(
  roundDay: number,
  ladderSlot: number,
  growthSeed: number,
  totalSlots: number,
): number {
  const { minNw, maxNw } = interpolateNpcLadderBand(roundDay);
  const slotT = totalSlots <= 1 ? 0 : ladderSlot / (totalSlots - 1);
  const curved = Math.pow(slotT, 0.72);
  const rng = createSeededRng(growthSeed * 7919 + 42);
  const jitter = 1 + rng.nextFloat(-0.06, 0.06);
  return Math.round((minNw + (maxNw - minNw) * curved) * jitter);
}

export function buildNpcTargetState(input: {
  archetype: NpcArchetypeId;
  roundDay: number;
  ladderSlot: number;
  growthSeed: number;
  totalSlots: number;
}): NpcTargetAssetState {
  const profile = NPC_ARCHETYPE_PROFILES[input.archetype];
  const targetNw = computeNpcTargetNw(
    input.roundDay,
    input.ladderSlot,
    input.growthSeed,
    input.totalSlots,
  );
  const rng = createSeededRng(input.growthSeed + input.roundDay * 9973);
  const businesses = planBusinesses(input.archetype, input.roundDay, input.growthSeed);
  const bizCtx = businessNwContext(businesses);
  let remaining = Math.max(
    0,
    targetNw -
      bizCtx.businessStreetAssets -
      bizCtx.assignedWorkers * CANONICAL_NET_WORTH_VALUATIONS.worker -
      (bizCtx.assignedSecurityThugs ?? 0) * CANONICAL_NET_WORTH_VALUATIONS.thug,
  );

  const cash = Math.max(500, Math.floor(remaining * profile.cashFraction));
  remaining -= cash;

  const drugUnits = Math.max(0, Math.floor((remaining * profile.drugFraction) / CANONICAL_NET_WORTH_VALUATIONS.drugUnit));
  remaining -= drugUnits * CANONICAL_NET_WORTH_VALUATIONS.drugUnit;

  const crewBudget = remaining;
  const crewTotalLean = profile.workerLean + profile.thugLean;
  const workerNw = crewBudget * (profile.workerLean / crewTotalLean);
  const thugNw = crewBudget * (profile.thugLean / crewTotalLean);

  let prostitutes = Math.max(profile.minWorkers, Math.floor(workerNw / CANONICAL_NET_WORTH_VALUATIONS.worker));
  let thugs = Math.max(profile.minThugs, Math.floor(thugNw / CANONICAL_NET_WORTH_VALUATIONS.thug));

  let rides = Math.max(1, Math.ceil(thugs / NPC_THUGS_PER_RIDE));
  let rideCost = rides * CANONICAL_NET_WORTH_VALUATIONS.vehicle;
  while (rideCost > remaining * 0.15 && rides > 1) {
    rides--;
    rideCost = rides * CANONICAL_NET_WORTH_VALUATIONS.vehicle;
  }

  const glocks = Math.min(thugs, Math.max(1, Math.floor(thugs * profile.glockCoverage)));
  const uzis = Math.min(Math.max(0, thugs - glocks), Math.floor(thugs * profile.uziCoverage));
  const aks = Math.min(Math.max(0, thugs - glocks - uzis), Math.floor(thugs * profile.akCoverage));

  const coke = Math.floor(drugUnits * (0.35 + rng.nextFloat(0, 0.15)));
  const heroin = Math.floor(drugUnits * 0.2);
  const hash = Math.floor(drugUnits * 0.25);
  const shrooms = Math.max(0, drugUnits - coke - heroin - hash);

  let state: NpcTargetAssetState = {
    cash,
    bankCash: 0,
    prostitutes,
    thugs,
    rides,
    glocks,
    uzis,
    aks,
    beer: Math.max(5, thugs * 2),
    condoms: Math.max(5, prostitutes * 2),
    hash,
    shrooms,
    coke,
    heroin,
    businesses,
  };

  let guard = 0;
  while (nwForState(state, businesses) < targetNw * 0.92 && guard < 16) {
    if (guard % 4 === 0) state.prostitutes += 1;
    else if (guard % 4 === 1) state.thugs += 1;
    else if (guard % 4 === 2) state.cash += Math.max(1000, Math.floor(targetNw * 0.02));
    else state.coke += 10;
    guard++;
  }

  let nw = nwForState(state, businesses);
  if (nw > targetNw * 1.08) {
    const ratio = targetNw / nw;
    state.cash = Math.floor(state.cash * ratio);
    state.prostitutes = Math.max(1, Math.floor(state.prostitutes * ratio));
    state.thugs = Math.max(1, Math.floor(state.thugs * ratio));
    state.rides = Math.max(1, Math.floor(state.rides * ratio));
    state.hash = Math.floor(state.hash * ratio);
    state.shrooms = Math.floor(state.shrooms * ratio);
    state.coke = Math.floor(state.coke * ratio);
    state.heroin = Math.floor(state.heroin * ratio);
    for (const b of businesses) {
      b.assignedWorkers = Math.floor(b.assignedWorkers * ratio);
      b.assignedThugs = Math.floor(b.assignedThugs * ratio);
    }
  }

  state.rides = Math.max(state.rides, Math.ceil(state.thugs / NPC_THUGS_PER_RIDE));

  return state;
}

export function canonicalNwForTargetState(state: NpcTargetAssetState): number {
  return nwForState(state, state.businesses);
}

/** Approximate invested value for business row creation. */
export function businessPurchasePriceForPlan(plan: NpcBusinessPlan): number {
  return businessPurchasePrice(plan.businessType) + Math.max(0, plan.level - 1) * Math.floor(businessPurchasePrice(plan.businessType) * 0.35);
}
