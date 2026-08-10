import { REDLITE_ATTACK, REDLITE_VEHICLES, REDLITE_WEAPONS } from './redlite-rules';

/** Neon Underworld Attack v1 — single source of truth */
export const ATTACK_RULES = {
  netWorthMinMultiplier: REDLITE_ATTACK.minNetWorthMultiplier,

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
    DRIVE_BY: 2,
    HOME_INVASION: 3,
    RAID_DRUG_LABS: 3,
  } as const,

  /** Turns to gather player intel before attacking (optional — direct attacks skip this) */
  scoutIntelTurnCost: 5,
  intelGatherTurnCost: 5,

  /** Player intel report validity */
  scoutReportExpiryHours: 48,

  /** Max attacks per attacker→target pair in rolling 24h (all v1 types combined) */
  targetAttackCapPer24h: 20,

  /** Minimum thugs to launch any attack */
  minAttackingThugs: 1,

  /** Max thugs per single attack request */
  maxAttackingThugs: 5000,

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
  DRIVE_BY: 'Drive-By Shooting',
  HOME_INVASION: 'Home Invasion',
  RAID_DRUG_LABS: 'Raid Drug Labs',
};

export const ATTACK_TYPE_PURPOSE: Record<AttackType, string> = {
  DRIVE_BY: 'Destroy defending thugs and weaken protection. No asset theft.',
  HOME_INVASION: 'Defeat defenders and steal exposed cash on hand. Bank is protected.',
  RAID_DRUG_LABS: 'Defeat defenders and steal drugs from stock.',
};
