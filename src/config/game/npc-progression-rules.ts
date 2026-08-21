import type { BusinessType } from '@prisma/client';

/** Attackable NPC archetypes — progression profile only (not avatar). */
export const NPC_ARCHETYPE_IDS = [
  'STREET_HUSTLER',
  'ENFORCER',
  'OPERATOR',
  'KINGPIN',
  'SYNDICATE_BOSS',
] as const;

export type NpcArchetypeId = (typeof NPC_ARCHETYPE_IDS)[number];

export interface NpcArchetypeProfile {
  id: NpcArchetypeId;
  label: string;
  /** Worker share of crew NW budget (remainder → thugs). */
  workerLean: number;
  thugLean: number;
  /** Fraction of target NW held as cash. */
  cashFraction: number;
  /** Fraction of target NW held as drugs (units × $5). */
  drugFraction: number;
  /** Business portfolio depth 0–3. */
  businessTier: number;
  /** Weapon coverage ratios vs thug count. */
  glockCoverage: number;
  uziCoverage: number;
  akCoverage: number;
  minWorkers: number;
  minThugs: number;
}

export const NPC_ARCHETYPE_PROFILES: Record<NpcArchetypeId, NpcArchetypeProfile> = {
  STREET_HUSTLER: {
    id: 'STREET_HUSTLER',
    label: 'Street Runner',
    workerLean: 0.72,
    thugLean: 0.28,
    cashFraction: 0.22,
    drugFraction: 0.04,
    businessTier: 0,
    glockCoverage: 0.35,
    uziCoverage: 0.05,
    akCoverage: 0,
    minWorkers: 2,
    minThugs: 2,
  },
  ENFORCER: {
    id: 'ENFORCER',
    label: 'Enforcer',
    workerLean: 0.22,
    thugLean: 0.78,
    cashFraction: 0.16,
    drugFraction: 0.03,
    businessTier: 0,
    glockCoverage: 0.55,
    uziCoverage: 0.25,
    akCoverage: 0.1,
    minWorkers: 1,
    minThugs: 8,
  },
  OPERATOR: {
    id: 'OPERATOR',
    label: 'Operator',
    workerLean: 0.55,
    thugLean: 0.45,
    cashFraction: 0.14,
    drugFraction: 0.06,
    businessTier: 1,
    glockCoverage: 0.4,
    uziCoverage: 0.15,
    akCoverage: 0.05,
    minWorkers: 5,
    minThugs: 5,
  },
  KINGPIN: {
    id: 'KINGPIN',
    label: 'Power Broker',
    workerLean: 0.48,
    thugLean: 0.52,
    cashFraction: 0.11,
    drugFraction: 0.08,
    businessTier: 2,
    glockCoverage: 0.45,
    uziCoverage: 0.2,
    akCoverage: 0.12,
    minWorkers: 15,
    minThugs: 20,
  },
  SYNDICATE_BOSS: {
    id: 'SYNDICATE_BOSS',
    label: 'Faction Boss',
    workerLean: 0.42,
    thugLean: 0.58,
    cashFraction: 0.09,
    drugFraction: 0.1,
    businessTier: 3,
    glockCoverage: 0.5,
    uziCoverage: 0.28,
    akCoverage: 0.18,
    minWorkers: 30,
    minThugs: 50,
  },
};

/** Round-age NW ladder checkpoints — interpolated between days. */
export const NPC_NW_LADDER_CHECKPOINTS = [
  { day: 1, minNw: 10_000, maxNw: 240_000 },
  { day: 7, minNw: 100_000, maxNw: 8_000_000 },
  { day: 15, minNw: 250_000, maxNw: 25_000_000 },
  { day: 30, minNw: 500_000, maxNw: 100_000_000 },
] as const;

/** Daily fraction of gap closed toward target (losses recover gradually). */
export const NPC_PROGRESSION_RECOVERY_RATE = 0.12;

/** Simulated activity window — progression runs on this cadence. */
export const NPC_PROGRESSION_TICK_HOURS = 6;

/** Max elapsed hours applied in one run (prevents unlimited historical catch-up). */
export const NPC_PROGRESSION_MAX_CATCHUP_HOURS = 48;

/** Turns regenerated per 6-hour tick at full activity (576/day ÷ 4). */
export const NPC_PROGRESSION_TURNS_PER_TICK = 144;

/** Optional email prefix for static local fixtures when NPC_PROGRESSION_INCLUDE_LOCAL=true. */
export const NPC_LOCAL_FIXTURE_PREFIX = 'local-npc+' as const;

/** Per-archetype simulated activity for 6-hour ticks (not shown to players). */
export interface NpcArchetypeTickProfile {
  /** Fraction of regen turns spent on core loop this tick. */
  activityRate: number;
  scoutShare: number;
  produceShare: number;
  /** Fraction of liquid cash earmarked for crew/equipment spend. */
  militarySpend: number;
  /** Multiplier on setback severity (<1 = resilient, >1 = volatile). */
  setbackVolatility: number;
  /** Bank deposit threshold multiplier vs archetype cash fraction. */
  bankThresholdMult: number;
}

export const NPC_ARCHETYPE_TICK_PROFILES: Record<NpcArchetypeId, NpcArchetypeTickProfile> = {
  STREET_HUSTLER: {
    activityRate: 0.72,
    scoutShare: 0.68,
    produceShare: 0.22,
    militarySpend: 0.08,
    setbackVolatility: 0.85,
    bankThresholdMult: 0.6,
  },
  ENFORCER: {
    activityRate: 0.58,
    scoutShare: 0.32,
    produceShare: 0.12,
    militarySpend: 0.38,
    setbackVolatility: 1.15,
    bankThresholdMult: 0.45,
  },
  OPERATOR: {
    activityRate: 0.68,
    scoutShare: 0.52,
    produceShare: 0.28,
    militarySpend: 0.18,
    setbackVolatility: 1,
    bankThresholdMult: 0.75,
  },
  KINGPIN: {
    activityRate: 0.62,
    scoutShare: 0.48,
    produceShare: 0.32,
    militarySpend: 0.22,
    setbackVolatility: 0.95,
    bankThresholdMult: 1.1,
  },
  SYNDICATE_BOSS: {
    activityRate: 0.52,
    scoutShare: 0.42,
    produceShare: 0.28,
    militarySpend: 0.28,
    setbackVolatility: 1.05,
    bankThresholdMult: 1.25,
  },
};

/** Thugs per ride for logistics planning. */
export const NPC_THUGS_PER_RIDE = 5;

/** Default ladder population (playtest NPC count). */
export const NPC_LADDER_TOTAL_SLOTS = 50;

/** Email prefixes eligible for ladder progression (attackable seeded opponents). */
export const NPC_PROGRESSION_EMAIL_PREFIXES = ['playtest-npc+', 'dev-pvp+'] as const;

export interface NpcBusinessPlan {
  businessType: BusinessType;
  level: number;
  assignedWorkers: number;
  assignedThugs: number;
}

export function archetypeForLadderSlot(ladderSlot: number, totalSlots: number): NpcArchetypeId {
  const t = totalSlots <= 1 ? 0 : ladderSlot / (totalSlots - 1);
  if (t < 0.22) return 'STREET_HUSTLER';
  if (t < 0.42) return 'ENFORCER';
  if (t < 0.62) return 'OPERATOR';
  if (t < 0.85) return 'KINGPIN';
  return 'SYNDICATE_BOSS';
}

export function interpolateNpcLadderBand(roundDay: number): { minNw: number; maxNw: number } {
  const day = Math.max(1, Math.floor(roundDay));
  const checkpoints = NPC_NW_LADDER_CHECKPOINTS;
  if (day <= checkpoints[0]!.day) return { minNw: checkpoints[0]!.minNw, maxNw: checkpoints[0]!.maxNw };
  const last = checkpoints[checkpoints.length - 1]!;
  if (day >= last.day) return { minNw: last.minNw, maxNw: last.maxNw };

  for (let i = 0; i < checkpoints.length - 1; i++) {
    const a = checkpoints[i]!;
    const b = checkpoints[i + 1]!;
    if (day >= a.day && day <= b.day) {
      const span = b.day - a.day;
      const t = span <= 0 ? 1 : (day - a.day) / span;
      return {
        minNw: Math.round(a.minNw + (b.minNw - a.minNw) * t),
        maxNw: Math.round(a.maxNw + (b.maxNw - a.maxNw) * t),
      };
    }
  }
  return { minNw: last.minNw, maxNw: last.maxNw };
}
