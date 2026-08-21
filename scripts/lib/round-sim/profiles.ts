import type { ProductionDrug } from '../../../src/lib/game-engine/production';
import type { AttackType } from '../../../src/config/game/attack-rules';
import type { DistrictSlug } from '../../../src/config/game/scout-area-names';
import type { ScoutAreaSlug } from '../monthly-sim/engine';

export type ActivityLevel = 'CASUAL' | 'REGULAR' | 'ACTIVE' | 'POWER';
export type StrategyArchetype = 'GROWTH' | 'ECONOMY' | 'AGGRESSIVE' | 'BALANCED' | 'INEFFICIENT';

export interface PlayerProfile {
  activity: ActivityLevel;
  strategy: StrategyArchetype;
  /** Fraction of daily regen turns the player actually spends */
  activityRate: number;
  /** Sessions per day (modelled as turn-budget chunks) */
  sessionsPerDay: number;
  payoutPercent: number;
  primaryScoutArea: ScoutAreaSlug;
  secondaryScoutArea: ScoutAreaSlug;
  preferredProduceDrug: ProductionDrug | 'mixed';
  weaponTier: 'glock' | 'uzi' | 'mixed';
  travelEnabled: boolean;
  bankDepositThreshold: number;
  bankRetainFraction: number;
  businessPriority: 'none' | 'mixed' | 'worker' | 'thug';
  reserveCashFraction: number;
  scoutShare: number;
  produceShare: number;
  combatShare: number;
  intelShare: number;
  attacksPerDay: { min: number; max: number };
  attackTypeWeights: Partial<Record<AttackType, number>>;
  inefficiency: number;
}

const ACTIVITY: Record<
  ActivityLevel,
  Pick<PlayerProfile, 'activityRate' | 'sessionsPerDay' | 'attacksPerDay'>
> = {
  CASUAL: { activityRate: 0.28, sessionsPerDay: 1, attacksPerDay: { min: 0, max: 1 } },
  REGULAR: { activityRate: 0.62, sessionsPerDay: 2, attacksPerDay: { min: 0, max: 2 } },
  ACTIVE: { activityRate: 0.82, sessionsPerDay: 3.5, attacksPerDay: { min: 1, max: 3 } },
  POWER: { activityRate: 0.96, sessionsPerDay: 4, attacksPerDay: { min: 2, max: 5 } },
};

const STRATEGY: Record<
  StrategyArchetype,
  Omit<
    PlayerProfile,
    'activity' | 'strategy' | 'activityRate' | 'sessionsPerDay' | 'attacksPerDay'
  >
> = {
  GROWTH: {
    payoutPercent: 50,
    primaryScoutArea: 'clubs',
    secondaryScoutArea: 'streets',
    preferredProduceDrug: 'hash',
    weaponTier: 'glock',
    travelEnabled: false,
    bankDepositThreshold: 250_000,
    bankRetainFraction: 0.45,
    businessPriority: 'none',
    reserveCashFraction: 0.3,
    scoutShare: 0.68,
    produceShare: 0.22,
    combatShare: 0.05,
    intelShare: 0.05,
    attackTypeWeights: { DRIVE_BY: 0.5, HOME_INVASION: 0.35, RAID_DRUG_LABS: 0.1, POACH_WORKERS: 0.05 },
    inefficiency: 0,
  },
  ECONOMY: {
    payoutPercent: 25,
    primaryScoutArea: 'clubs',
    secondaryScoutArea: 'markets',
    preferredProduceDrug: 'mixed',
    weaponTier: 'glock',
    travelEnabled: true,
    bankDepositThreshold: 40_000,
    bankRetainFraction: 0.2,
    businessPriority: 'worker',
    reserveCashFraction: 0.15,
    scoutShare: 0.38,
    produceShare: 0.42,
    combatShare: 0.05,
    intelShare: 0.05,
    attackTypeWeights: { HOME_INVASION: 0.45, RAID_DRUG_LABS: 0.35, DRIVE_BY: 0.15, POACH_WORKERS: 0.05 },
    inefficiency: 0,
  },
  AGGRESSIVE: {
    payoutPercent: 50,
    primaryScoutArea: 'docks',
    secondaryScoutArea: 'alleys',
    preferredProduceDrug: 'coke',
    weaponTier: 'uzi',
    travelEnabled: false,
    bankDepositThreshold: 500_000,
    bankRetainFraction: 0.55,
    businessPriority: 'thug',
    reserveCashFraction: 0.25,
    scoutShare: 0.35,
    produceShare: 0.25,
    combatShare: 0.32,
    intelShare: 0.08,
    attackTypeWeights: { HOME_INVASION: 0.35, RAID_DRUG_LABS: 0.3, DRIVE_BY: 0.25, POACH_WORKERS: 0.1 },
    inefficiency: 0,
  },
  BALANCED: {
    payoutPercent: 50,
    primaryScoutArea: 'clubs',
    secondaryScoutArea: 'docks',
    preferredProduceDrug: 'mixed',
    weaponTier: 'mixed',
    travelEnabled: true,
    bankDepositThreshold: 120_000,
    bankRetainFraction: 0.35,
    businessPriority: 'mixed',
    reserveCashFraction: 0.22,
    scoutShare: 0.45,
    produceShare: 0.4,
    combatShare: 0.1,
    intelShare: 0.05,
    attackTypeWeights: { HOME_INVASION: 0.35, RAID_DRUG_LABS: 0.25, DRIVE_BY: 0.25, POACH_WORKERS: 0.15 },
    inefficiency: 0,
  },
  INEFFICIENT: {
    payoutPercent: 60,
    primaryScoutArea: 'markets',
    secondaryScoutArea: 'streets',
    preferredProduceDrug: 'hash',
    weaponTier: 'glock',
    travelEnabled: false,
    bankDepositThreshold: 999_999_999,
    bankRetainFraction: 0.85,
    businessPriority: 'none',
    reserveCashFraction: 0.45,
    scoutShare: 0.42,
    produceShare: 0.28,
    combatShare: 0.08,
    intelShare: 0.05,
    attackTypeWeights: { DRIVE_BY: 0.4, HOME_INVASION: 0.35, RAID_DRUG_LABS: 0.15, POACH_WORKERS: 0.1 },
    inefficiency: 0.35,
  },
};

export function buildPlayerProfile(activity: ActivityLevel, strategy: StrategyArchetype): PlayerProfile {
  const base = ACTIVITY[activity];
  const strat = STRATEGY[strategy];
  const attacks =
    strategy === 'AGGRESSIVE'
      ? {
          min: base.attacksPerDay.min + 1,
          max: base.attacksPerDay.max + 2,
        }
      : strategy === 'INEFFICIENT'
        ? { min: 0, max: Math.max(1, base.attacksPerDay.max) }
        : base.attacksPerDay;

  return {
    activity,
    strategy,
    activityRate: base.activityRate,
    sessionsPerDay: base.sessionsPerDay,
    attacksPerDay: attacks,
    ...strat,
  };
}

export const ACTIVITY_LEVELS: ActivityLevel[] = ['CASUAL', 'REGULAR', 'ACTIVE', 'POWER'];
export const STRATEGIES: StrategyArchetype[] = [
  'GROWTH',
  'ECONOMY',
  'AGGRESSIVE',
  'BALANCED',
  'INEFFICIENT',
];

export const DISTRICTS_FOR_SIM: DistrictSlug[] = ['neon-strip', 'docklands', 'old-quarter'];

export function assignProfiles(count: number, seed: number): PlayerProfile[] {
  const profiles: PlayerProfile[] = [];
  let rng = seed >>> 0;
  const next = () => {
    rng = (rng * 1664525 + 1013904223) >>> 0;
    return rng;
  };
  for (let i = 0; i < count; i++) {
    const activity = ACTIVITY_LEVELS[i % ACTIVITY_LEVELS.length]!;
    const strategy = STRATEGIES[Math.floor(i / ACTIVITY_LEVELS.length) % STRATEGIES.length]!;
    profiles.push(buildPlayerProfile(activity, strategy));
    if (next() % 5 === 0) {
      const swap = STRATEGIES[next() % STRATEGIES.length]!;
      profiles[i] = buildPlayerProfile(activity, swap);
    }
  }
  return profiles;
}
