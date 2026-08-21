/**
 * Canonical constants table for simulation reports — code is source of truth.
 */
import {
  STARTING_RESOURCES,
  TURNS_CONFIG,
  SCOUTING_CONFIG,
  PRODUCTION_CONFIG,
} from '../../../src/config/game/balance';
import { ATTACK_RULES } from '../../../src/config/game/attack-rules';
import {
  REDLITE_TRAVEL,
  REDLITE_TURNS,
  ATTACK_MIN_TARGET_NET_WORTH_RATIO,
} from '../../../src/config/game/redlite-rules';
import { DRUG_PRODUCTION_RATES } from '../../../src/config/game/drug-production-rates';
import { CANONICAL_NET_WORTH_VALUATIONS } from '../../../src/lib/game-engine/canonical-net-worth';
import { THUG_HIRE_PRICE } from '../../../src/config/game/hire-thugs-rules';
import {
  BUSINESS_TYPE_RULES,
  MAX_BUSINESSES_PER_PLAYER,
  BUSINESS_PASSIVE_INCOME_FRACTION,
  BUSINESS_STREET_NW_MULTIPLIER,
} from '../../../src/config/game/business-rules';
import { TURNS_PER_DAY } from '../monthly-sim/engine';

export function canonicalConstantsTable() {
  return {
    starting: {
      cash: STARTING_RESOURCES.cash,
      workers: STARTING_RESOURCES.prostitutes,
      thugs: STARTING_RESOURCES.thugs,
      rides: STARTING_RESOURCES.rides,
      glocks: STARTING_RESOURCES.glocks,
      payoutPercent: STARTING_RESOURCES.prostitutePayoutPercent,
      workerMorale: STARTING_RESOURCES.prostituteHappiness,
      thugMorale: STARTING_RESOURCES.thugHappiness,
      turns: TURNS_CONFIG.startingTurns,
      bankCash: 0,
    },
    turns: {
      cap: TURNS_CONFIG.turnCap,
      regenPerInterval: REDLITE_TURNS.turnsPerInterval,
      intervalMinutes: REDLITE_TURNS.intervalMinutes,
      perDay: TURNS_PER_DAY,
      scoutProduceMin: TURNS_CONFIG.minScoutSpend,
      scoutProduceMax: TURNS_CONFIG.maxScoutSpend,
    },
    scout: {
      workerRatePerTurn: SCOUTING_CONFIG.baseProstitutesPerTurn,
      thugRatePerTurn: SCOUTING_CONFIG.baseThugsPerTurn,
      cashPerWorkerPerTurn: SCOUTING_CONFIG.cashPerProstitutePerTurn,
      rngVariance: [SCOUTING_CONFIG.varianceMin, SCOUTING_CONFIG.varianceMax],
    },
    produce: {
      cashPerWorkerPerTurn: PRODUCTION_CONFIG.cashPerProstitutePerTurn,
      drugRates: DRUG_PRODUCTION_RATES,
    },
    attack: {
      intelBasic: ATTACK_RULES.scoutIntelTurnCost,
      intelDeep: ATTACK_RULES.deepIntelTurnCost,
      turnCosts: { ...ATTACK_RULES.turnCosts },
      targetNwMinRatio: ATTACK_MIN_TARGET_NET_WORTH_RATIO,
      capPerTarget24h: ATTACK_RULES.targetAttackCapPer24h,
      cashTheftPct: [ATTACK_RULES.cashTheftBasePercent, ATTACK_RULES.cashTheftMaxPercent],
      drugTheftPct: [ATTACK_RULES.drugTheftBasePercent, ATTACK_RULES.drugTheftMaxPercent],
    },
    travel: { turnCost: REDLITE_TRAVEL.turnCost },
    shop: {
      glock: 500,
      uzi: 1500,
      ak: 3800,
      ride: 2500,
      hireThug: THUG_HIRE_PRICE,
    },
    businesses: {
      maxPerPlayer: MAX_BUSINESSES_PER_PLAYER,
      passiveIncomeFraction: BUSINESS_PASSIVE_INCOME_FRACTION,
      streetNwMultiplier: BUSINESS_STREET_NW_MULTIPLIER,
      purchasePrices: {
        WAREHOUSE: BUSINESS_TYPE_RULES.WAREHOUSE.purchasePrice,
        NIGHTCLUB: BUSINESS_TYPE_RULES.NIGHTCLUB.purchasePrice,
        DRUG_LAB: BUSINESS_TYPE_RULES.DRUG_LAB.purchasePrice,
      },
    },
    banking: {
      fee: 0,
      minTransaction: 1,
    },
    netWorth: CANONICAL_NET_WORTH_VALUATIONS,
  };
}

export type HypotheticalOverrides = {
  label: string;
  turnRegenMultiplier?: number;
  attackTurnCostMultiplier?: number;
  scoutWorkerRateMultiplier?: number;
};

export const HYPOTHETICAL_SCENARIOS: HypotheticalOverrides[] = [
  {
    label: 'HYPOTHETICAL — +25% turn regen (NOT IMPLEMENTED)',
    turnRegenMultiplier: 1.25,
  },
  {
    label: 'HYPOTHETICAL — pre-UX attack costs ×0.4 (2/3/3/4 equivalent, NOT IMPLEMENTED)',
    attackTurnCostMultiplier: 0.4,
  },
  {
    label: 'HYPOTHETICAL — +15% scout worker rate (NOT IMPLEMENTED)',
    scoutWorkerRateMultiplier: 1.15,
  },
];
