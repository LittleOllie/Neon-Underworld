import { REDLITE_ATTACK, REDLITE_VEHICLES, REDLITE_WEAPONS } from './redlite-rules';

/** Neon Underworld Attack v1 — single source of truth */
export const ATTACK_RULES = {
  netWorthMinMultiplier: REDLITE_ATTACK.minNetWorthMultiplier,
  netWorthMaxMultiplier: REDLITE_ATTACK.maxNetWorthMultiplier,

  /** 1 ride per 5 attacking thugs (Neon simplification — all v1 mobile attacks) */
  thugsPerRide: REDLITE_VEHICLES.thugsPerRide,

  weapons: {
    glock: { strength: REDLITE_WEAPONS.glock.combatCapacity, key: 'glock' as const },
    uzi: { strength: REDLITE_WEAPONS.uzi.combatCapacity, key: 'uzi' as const },
    ak: { strength: REDLITE_WEAPONS.ak.combatCapacity, key: 'ak' as const },
    unarmedStrength: 1,
    /** Strongest-first allocation order */
    allocationOrder: ['ak', 'uzi', 'glock'] as const,
  },

  turnCosts: {
    DRIVE_BY: 5,
    HOME_INVASION: 8,
    RAID_DRUG_LABS: 10,
    POACH_WORKERS: 12,
  } as const,

  /** Turns to gather basic player intel before attacking (optional — direct attacks skip this) */
  scoutIntelTurnCost: 5,
  intelGatherTurnCost: 5,

  /** Turns to gather deep intel after basic intel exists on a same-city target */
  deepIntelTurnCost: 20,

  /** Player intel report validity */
  scoutReportExpiryHours: 48,

  /** Max attacks per attacker→target pair in rolling 24h (all v1 types combined) */
  targetAttackCapPer24h: 20,

  /** Minimum thugs to launch any attack */
  minAttackingThugs: 1,

  /** Max thugs per single attack request — per-type caps in combat/commitment.ts may be lower */
  maxAttackingThugs: 25000,

  blockedAttackerLifeStatuses: ['HOSPITALIZED', 'JAIL', 'INACTIVE'] as const,
  blockedDefenderLifeStatuses: ['INACTIVE'] as const,

  /** Home invasion — fraction of exposed cash stealable on strong victory */
  cashTheftBasePercent: 0.35,
  cashTheftMaxPercent: 0.65,

  /** Drug raid — fraction of total drug stock stealable on strong victory */
  drugTheftBasePercent: 0.25,
  drugTheftMaxPercent: 0.5,

  /** Controlled randomness bounds applied to force scores */
  randomVarianceMin: 0.88,
  randomVarianceMax: 1.12,

/** Cartel defence — virtual thug support from same-city mates */
  cartelDefenceActive: true,
} as const;

export type AttackType = keyof typeof ATTACK_RULES.turnCosts;

export const ATTACK_TYPE_LABELS: Record<AttackType, string> = {
  DRIVE_BY: 'Strike',
  HOME_INVASION: 'Breach',
  RAID_DRUG_LABS: 'Raid',
  POACH_WORKERS: 'Extraction',
};

export const ATTACK_TYPE_PURPOSE: Record<AttackType, string> = {
  DRIVE_BY:
    'Clash with their Enforcers to inflict crew losses. Strike does not take Cash, stock, or Specialists — a full win needs damage on their line.',
  HOME_INVASION:
    'Break in to seize exposed Cash they are holding on hand. Vault funds stay protected, and you need a strong win with enough survivors to take anything.',
  RAID_DRUG_LABS:
    'Strip Components, Chips, Modules, and Cores from their stockpiles. Requires a decisive win — no payout if stock is empty or your force takes heavy losses.',
  POACH_WORKERS:
    'Attempt to pull Specialists from their operation into yours. Targets need a sizeable workforce; extraction yields crew, not Cash or stock.',
};
