import { calculateProstituteHappiness, calculateThugHappiness } from '@core/lib/game-engine/happiness';
import { SCOUTING_CONFIG } from '@core/config/game/balance';
import { happinessBand, supplyBand, payoutTradeOffDescription } from '@core/lib/game-engine/supply-status';
import { supplyReadinessToPercent } from '@local/server/domain/status-presentation';
import {
  EMPIRE_BANK_RULES,
  EMPIRE_BUSINESS_TYPES,
  EMPIRE_DRUG_TYPES,
  EMPIRE_PAYOUT_RULES,
  EMPIRE_READINESS_RULES,
  EMPIRE_VEHICLE_TYPES,
  EMPIRE_WEAPON_TYPES,
  type DrugKey,
  type VehicleKey,
  type WeaponKey,
} from '@local/config/empire-rules';
import { businessNetWorth } from '@local/config/valuations';
import { OS_TERMS } from '@local/config/terminology';
import type { ReadinessDetail } from '@local/domain/empire.model';

export type PlayerInventoryRow = {
  thugs: number;
  prostitutes: number;
  glocks: number;
  uzis: number;
  aks: number;
  rides: number;
  hash: number;
  shrooms: number;
  coke: number;
  heroin: number;
  businesses: number;
  condoms: number;
  beer: number;
  prostitutePayoutPercent: number;
};

export function calculateArming(thugs: number, glocks: number, uzis: number, aks: number) {
  const usableWeapons = glocks + uzis + aks;
  const armedThugs = Math.min(thugs, usableWeapons);
  const unarmedThugs = Math.max(0, thugs - usableWeapons);
  const surplusWeapons = Math.max(0, usableWeapons - thugs);
  const shortage = unarmedThugs;
  return {
    totalWeapons: usableWeapons,
    usableWeapons,
    armedThugs,
    unarmedThugs,
    surplusWeapons,
    shortage,
  };
}

export function buildWeaponsBreakdown(player: PlayerInventoryRow) {
  const quantities: Record<WeaponKey, number> = {
    glocks: player.glocks,
    uzis: player.uzis,
    aks: player.aks,
  };
  const byType = EMPIRE_WEAPON_TYPES.map((t) => ({
    key: t.key,
    name: t.name,
    quantity: quantities[t.key],
    combatValue: t.combatValue,
  }));
  const arming = calculateArming(player.thugs, player.glocks, player.uzis, player.aks);
  return {
    ...arming,
    byType,
  };
}

export function buildVehiclesBreakdown(player: PlayerInventoryRow) {
  const quantities: Record<VehicleKey, number> = { rides: player.rides };
  const byType = EMPIRE_VEHICLE_TYPES.map((t) => ({
    key: t.key,
    name: t.name,
    quantity: quantities[t.key],
    capacityEach: t.capacityEach,
    totalCapacity: quantities[t.key] * t.capacityEach,
  }));
  const totalVehicles = player.rides;
  const totalCapacity = byType.reduce((sum, v) => sum + v.totalCapacity, 0);
  const occupiedCapacity = 0;
  const availableCapacity = totalCapacity - occupiedCapacity;
  return { totalVehicles, totalCapacity, occupiedCapacity, availableCapacity, byType };
}

export function buildDrugsBreakdown(player: PlayerInventoryRow) {
  const quantities: Record<DrugKey, number> = {
    hash: player.hash,
    shrooms: player.shrooms,
    coke: player.coke,
    heroin: player.heroin,
  };
  const byType = EMPIRE_DRUG_TYPES.map((t) => ({
    key: t.key,
    name: t.name,
    quantity: quantities[t.key],
    valuationEach: t.valuationEach,
  }));
  const totalUnits = byType.reduce((sum, d) => sum + d.quantity, 0);
  const estimatedValue = byType.reduce((sum, d) => sum + d.quantity * d.valuationEach, 0);
  return { totalUnits, estimatedValue, byType };
}

export function buildBusinessesBreakdown(player: PlayerInventoryRow) {
  const byType = EMPIRE_BUSINESS_TYPES.map((t) => ({
    key: t.key,
    name: t.name,
    quantity: player.businesses,
    valueEach: t.valueEach,
  }));
  const total = player.businesses;
  const estimatedValue = businessNetWorth(total);
  return { total, estimatedValue, incomeActive: false, byType };
}

export function estimateWorkerMorale(player: PlayerInventoryRow): number {
  return calculateProstituteHappiness({
    prostitutes: player.prostitutes,
    thugs: player.thugs,
    hash: player.hash,
    condoms: player.condoms,
    prostitutePayoutPercent: player.prostitutePayoutPercent,
  }).score;
}

export function buildEmpireSupplySummary(player: PlayerInventoryRow) {
  const workerHappy = calculateProstituteHappiness({
    prostitutes: player.prostitutes,
    thugs: player.thugs,
    hash: player.hash,
    condoms: player.condoms,
    prostitutePayoutPercent: player.prostitutePayoutPercent,
  });
  const thugHappy = calculateThugHappiness({
    thugs: player.thugs,
    glocks: player.glocks,
    uzis: player.uzis,
    aks: player.aks,
    beer: player.beer,
  });
  const arming = calculateArming(player.thugs, player.glocks, player.uzis, player.aks);

  return {
    workers: {
      status: happinessBand(workerHappy.score),
      kits: supplyBand(workerHappy.condomReadiness),
      protection: supplyBand(workerHappy.protectionReadiness),
      payout: `${player.prostitutePayoutPercent}%`,
    },
    thugs: {
      status: happinessBand(thugHappy.score),
      weapons: arming.unarmedThugs > 0 ? `${arming.unarmedThugs} short` : 'Adequate',
      beer: supplyBand(thugHappy.beerReadiness),
      armed: `${arming.armedThugs} / ${player.thugs}`,
    },
  };
}

export function buildPreferredCrewSupplies(player: PlayerInventoryRow) {
  const workerHappy = calculateProstituteHappiness({
    prostitutes: player.prostitutes,
    thugs: player.thugs,
    hash: player.hash,
    condoms: player.condoms,
    prostitutePayoutPercent: player.prostitutePayoutPercent,
  });
  const thugHappy = calculateThugHappiness({
    thugs: player.thugs,
    glocks: player.glocks,
    uzis: player.uzis,
    aks: player.aks,
    beer: player.beer,
  });

  return {
    specialists: {
      shopItemKey: 'condom' as const,
      label: OS_TERMS.kits,
      quantity: player.condoms,
      readinessPercent: supplyReadinessToPercent(workerHappy.condomReadiness),
    },
    enforcers: {
      shopItemKey: 'beer' as const,
      label: OS_TERMS.rations,
      quantity: player.beer,
      readinessPercent: supplyReadinessToPercent(thugHappy.beerReadiness),
    },
  };
}

export function previewPayoutMorale(
  player: PlayerInventoryRow,
  proposedPayout: number,
): { currentMorale: number; proposedMorale: number; effects: string[] } {
  const currentMorale = estimateWorkerMorale(player);
  const proposedMorale = calculateProstituteHappiness({
    prostitutes: player.prostitutes,
    thugs: player.thugs,
    hash: player.hash,
    condoms: player.condoms,
    prostitutePayoutPercent: proposedPayout,
  }).score;

  const effects: string[] = [];
  const currentTrade = payoutTradeOffDescription(player.prostitutePayoutPercent);
  const proposedTrade = payoutTradeOffDescription(proposedPayout);

  if (proposedPayout < player.prostitutePayoutPercent) {
    effects.push('You will keep more worker-generated cash when using turns.');
    effects.push(proposedTrade.playerRetention);
  } else if (proposedPayout > player.prostitutePayoutPercent) {
    effects.push(`You will keep less ${OS_TERMS.specialist.toLowerCase()}-generated cash when using turns.`);
    effects.push(proposedTrade.workerStability);
  }

  if (proposedPayout >= 100) {
    effects.push(`At 100% payout you retain no ${OS_TERMS.specialist.toLowerCase()} income — fully defensive.`);
  }

  if (proposedMorale < SCOUTING_CONFIG.prostituteHappinessWarningThreshold) {
    effects.push(`${OS_TERMS.specialist} supplies are low — morale at risk when using turns.`);
  } else if (proposedMorale >= 80) {
    effects.push(`${OS_TERMS.specialist} supplies support stable operations.`);
  }

  if (effects.length === 0) {
    effects.push(currentTrade.playerRetention);
    effects.push(currentTrade.workerStability);
  }

  return { currentMorale, proposedMorale, effects };
}

export function validatePayoutPercent(value: number): string | null {
  if (!Number.isInteger(value) || Number.isNaN(value)) {
    return 'Payout must be a whole number';
  }
  if (value < EMPIRE_PAYOUT_RULES.minPercent || value > EMPIRE_PAYOUT_RULES.maxPercent) {
    return `Payout must be between ${EMPIRE_PAYOUT_RULES.minPercent}% and ${EMPIRE_PAYOUT_RULES.maxPercent}%`;
  }
  if (value % EMPIRE_PAYOUT_RULES.increment !== 0) {
    return `Payout must change in ${EMPIRE_PAYOUT_RULES.increment}% increments`;
  }
  return null;
}

export function validateBankAmount(amount: number): string | null {
  if (!Number.isInteger(amount) || Number.isNaN(amount) || amount <= 0) {
    return 'Amount must be a positive whole number';
  }
  if (amount < EMPIRE_BANK_RULES.minTransaction) {
    return `Minimum transfer is $${EMPIRE_BANK_RULES.minTransaction.toLocaleString()}`;
  }
  if (EMPIRE_BANK_RULES.maxTransaction !== null && amount > EMPIRE_BANK_RULES.maxTransaction) {
    return `Maximum transfer is $${EMPIRE_BANK_RULES.maxTransaction.toLocaleString()}`;
  }
  return null;
}

export function canUseBank(lifeStatus: string, travelling: boolean): string | null {
  if (EMPIRE_BANK_RULES.blockedLifeStatuses.includes(lifeStatus as (typeof EMPIRE_BANK_RULES.blockedLifeStatuses)[number])) {
    return 'Banking unavailable in your current life status';
  }
  if (EMPIRE_BANK_RULES.blockedWhileTravelling && travelling) {
    return 'Banking unavailable while travelling';
  }
  return null;
}

export interface ReadinessInput {
  workers: number;
  thugs: number;
  turns: number;
  usableWeapons: number;
  totalVehicles: number;
  totalCapacity: number;
  drugUnits: number;
  weaponCount: number;
  lifeStatus: string;
  travelling: boolean;
  unarmedThugs: number;
}

export function calculateOperationalReadiness(input: ReadinessInput) {
  const rules = EMPIRE_READINESS_RULES;
  const isActive = rules.activeLifeStatuses.includes(
    input.lifeStatus as (typeof rules.activeLifeStatuses)[number],
  );

  const productionNotes: string[] = [];
  let productionReady =
    input.workers >= rules.production.minWorkers && input.turns >= rules.production.minTurns;
  if (input.workers < rules.production.minWorkers) {
    productionNotes.push(`${OS_TERMS.specialists} required`);
  }
  if (input.turns < rules.production.minTurns) {
    productionNotes.push('Turns required');
  }

  const attackNotes: string[] = [];
  let attackReady =
    isActive &&
    !input.travelling &&
    input.thugs >= rules.attack.minThugs &&
    input.usableWeapons >= rules.attack.minWeapons &&
    input.totalVehicles >= rules.attack.minVehicles;
  if (!isActive) attackNotes.push('Must be active');
  if (input.travelling) attackNotes.push('Cannot attack while travelling');
  if (input.thugs < rules.attack.minThugs) attackNotes.push(`${OS_TERMS.enforcers} required`);
  if (input.usableWeapons < rules.attack.minWeapons) attackNotes.push('Usable weapons required');
  if (input.totalVehicles < rules.attack.minVehicles) attackNotes.push('Vehicles required');
  if (input.unarmedThugs > 0) {
    attackNotes.push(`${input.unarmedThugs} ${input.unarmedThugs === 1 ? OS_TERMS.enforcer.toLowerCase() : OS_TERMS.enforcers.toLowerCase()} are unarmed`);
  }
  attackNotes.push('Attack — coming soon');

  const travelNotes: string[] = [];
  let travelReady =
    isActive && !input.travelling && input.totalVehicles >= rules.travel.minVehicles;
  if (!isActive) travelNotes.push('Must be active');
  if (input.travelling) travelNotes.push('Already travelling');
  if (input.totalVehicles < rules.travel.minVehicles) travelNotes.push('Vehicles required');
  if (travelReady) {
    travelNotes.push(`Vehicle capacity: ${input.totalCapacity}`);
  }
  travelNotes.push('Travel — coming soon');

  const tradableUnits = input.drugUnits + input.weaponCount + input.totalVehicles;
  const marketNotes: string[] = [];
  let marketReady = isActive && tradableUnits >= rules.market.minTradableUnits;
  if (!isActive) marketNotes.push('Must be active');
  if (tradableUnits < rules.market.minTradableUnits) {
    marketNotes.push('Tradable inventory required');
  }
  marketNotes.push('Black Market — coming soon');

  const reasons: string[] = [];
  if (!productionReady) reasons.push('Production prerequisites not met');
  if (!attackReady) reasons.push('Attack prerequisites not met');
  if (!travelReady) reasons.push('Travel prerequisites not met');
  if (!marketReady) reasons.push('Market prerequisites not met');

  const warningCount = [
    !productionReady,
    !attackReady,
    !travelReady,
    !marketReady,
    input.unarmedThugs > 0,
  ].filter(Boolean).length;

  const details = {
    production: {
      ready: productionReady,
      label: 'Operations',
      status: productionReady ? 'Ready' : 'Not ready',
      notes: productionReady
        ? [`${OS_TERMS.specialists} available: ${input.workers}`, `Turns available: ${input.turns}`, 'Use Operations to run turns']
        : productionNotes,
    } satisfies ReadinessDetail,
    attack: {
      ready: attackReady,
      label: 'Attack',
      status: attackReady ? 'Ready (system pending)' : 'Not ready',
      notes: attackNotes,
    } satisfies ReadinessDetail,
    travel: {
      ready: travelReady,
      label: 'Travel',
      status: travelReady ? 'Ready (system pending)' : 'Not ready',
      notes: travelNotes,
    } satisfies ReadinessDetail,
    market: {
      ready: marketReady,
      label: 'Black Market',
      status: marketReady ? 'Ready (system pending)' : 'Not ready',
      notes: marketNotes,
    } satisfies ReadinessDetail,
  };

  return {
    productionReady,
    attackReady,
    travelReady,
    marketReady,
    warningCount,
    reasons,
    details,
  };
}
