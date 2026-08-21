import { REDLITE_PAYOUT, REDLITE_VEHICLES, REDLITE_WEAPONS } from '@core/config/game/redlite-rules';
import { TERMS } from '@core/config/game/terminology';
import { NET_WORTH_VALUATIONS, BUSINESS_DISPLAY_VALUE } from '@local/config/valuations';

/** Worker payout — Redlite: 1% max profit, 100% protection when idle */
export const EMPIRE_PAYOUT_RULES = {
  minPercent: REDLITE_PAYOUT.minPercent,
  maxPercent: REDLITE_PAYOUT.maxPercent,
  defaultPercent: 50,
  increment: 1,
  profitOptimalPercent: REDLITE_PAYOUT.profitOptimalPercent,
  protectionPercent: REDLITE_PAYOUT.protectionPercent,
} as const;

/** Bank transfer rules */
export const EMPIRE_BANK_RULES = {
  minTransaction: 1,
  maxTransaction: null as number | null,
  feePercent: 0,
  blockedLifeStatuses: ['HOSPITALIZED', 'JAIL', 'INACTIVE'] as const,
  blockedWhileTravelling: true,
} as const;

/** Weapon combat capacity — Redlite guide §7 (arming still 1 weapon : 1 thug) */
export const EMPIRE_WEAPON_TYPES = [
  { key: 'glocks', name: TERMS.glocks, combatValue: REDLITE_WEAPONS.glock.combatCapacity },
  { key: 'uzis', name: TERMS.uzis, combatValue: REDLITE_WEAPONS.uzi.combatCapacity },
  { key: 'aks', name: TERMS.aks, combatValue: REDLITE_WEAPONS.ak.combatCapacity },
] as const;

export type WeaponKey = (typeof EMPIRE_WEAPON_TYPES)[number]['key'];

/** 1 ride per 5 thugs on attacks — Redlite guide §7 */
export const EMPIRE_VEHICLE_TYPES = [
  { key: 'rides', name: 'Rides', capacityEach: REDLITE_VEHICLES.thugsPerRide },
] as const;

export type VehicleKey = (typeof EMPIRE_VEHICLE_TYPES)[number]['key'];

/** Drug display + canonical valuation per unit */
export const EMPIRE_DRUG_TYPES = [
  { key: 'hash', name: TERMS.hash, valuationEach: NET_WORTH_VALUATIONS.drugUnit },
  { key: 'shrooms', name: TERMS.shrooms, valuationEach: NET_WORTH_VALUATIONS.drugUnit },
  { key: 'coke', name: TERMS.coke, valuationEach: NET_WORTH_VALUATIONS.drugUnit },
  { key: 'heroin', name: TERMS.heroin, valuationEach: NET_WORTH_VALUATIONS.drugUnit },
] as const;

export type DrugKey = (typeof EMPIRE_DRUG_TYPES)[number]['key'];

export const EMPIRE_BUSINESS_TYPES = [
  { key: 'businesses', name: 'Owned Businesses', valueEach: BUSINESS_DISPLAY_VALUE },
] as const;

/** Operational readiness prerequisites */
export const EMPIRE_READINESS_RULES = {
  production: { minWorkers: 1, minTurns: 1 },
  attack: { minThugs: 1, minWeapons: 1, minVehicles: 1 },
  travel: { minVehicles: 1 },
  market: { minTradableUnits: 1 },
  activeLifeStatuses: ['ACTIVE'] as const,
} as const;

/** Activity categories shown on the Empire page feed */
export const EMPIRE_ACTIVITY_CATEGORIES = [
  'SCOUT',
  'PRODUCTION',
  'SHOP_PURCHASE',
  'SHOP_SELL',
  'WORKER_PAYOUT_UPDATED',
  'BANK_DEPOSIT',
  'BANK_WITHDRAWAL',
  'PERSONNEL_DISMISSED',
  'EMPIRE_UPDATED',
  'ATTACK',
  'DEFENCE',
] as const;

export type EmpireActivityCategory = (typeof EMPIRE_ACTIVITY_CATEGORIES)[number];

export const EMPIRE_ACTIVITY_CATEGORY_SET = new Set<string>(EMPIRE_ACTIVITY_CATEGORIES);
