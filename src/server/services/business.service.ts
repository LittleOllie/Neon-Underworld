import type { Business, BusinessType, Prisma } from '@prisma/client';
import {
  BUSINESS_DRUG_KEYS,
  businessHourlyIncome,
  businessPurchasePrice,
  businessStreetNwContribution,
  defaultBusinessName,
  getBusinessTypeRule,
  MAX_BUSINESSES_PER_PLAYER,
  type BusinessDrugKey,
} from '@/config/game/business-rules';
import { evaluateBusinessHeat, overallHeatBand } from '@/lib/game-engine/business/heat';
import { resolveBusinessRaidCheck } from '@/lib/game-engine/business/raids';
import { settleBusinessIncome } from '@/lib/game-engine/business/settlement';
import type { PrismaTransactionClient } from '@/lib/db/serializable-transaction';

export type BusinessRecord = Business;

export interface BusinessDrugInventory {
  hash: number;
  shrooms: number;
  coke: number;
  heroin: number;
}

export interface BusinessViewModel {
  id: string;
  businessType: BusinessType;
  displayName: string;
  name: string;
  districtId: string;
  districtName: string;
  purchasePrice: number;
  streetNwContribution: number;
  assignedWorkers: number;
  safeCash: number;
  safeCapacity: number;
  safeFull: boolean;
  hourlyIncome: number;
  storedDrugs: BusinessDrugInventory;
  storedDrugUnits: number;
  drugStorageCapacity: number;
  heatScore: number;
  heatBand: string;
  heatLabel: string;
  createdAt: string;
}

export interface BusinessPortfolioSummary {
  ownedCount: number;
  streetWorkers: number;
  assignedWorkers: number;
  totalSafeCash: number;
  totalStoredDrugs: number;
  overallHeatBand: string;
  businessStreetAssets: number;
}

export function businessStoredDrugs(row: Pick<Business, BusinessDrugKey>): BusinessDrugInventory {
  return {
    hash: row.hash,
    shrooms: row.shrooms,
    coke: row.coke,
    heroin: row.heroin,
  };
}

export function businessStoredTotal(row: Pick<Business, BusinessDrugKey>): number {
  const d = businessStoredDrugs(row);
  return d.hash + d.shrooms + d.coke + d.heroin;
}

export function aggregateBusinessNwContext(businesses: Pick<Business, 'purchasePrice' | 'assignedWorkers'>[]) {
  const assignedWorkers = businesses.reduce((sum, b) => sum + b.assignedWorkers, 0);
  const businessStreetAssets = businesses.reduce(
    (sum, b) => sum + businessStreetNwContribution(b.purchasePrice),
    0,
  );
  return { assignedWorkers, businessStreetAssets };
}

export interface SettledBusinessState {
  safeCash: number;
  hash: number;
  shrooms: number;
  coke: number;
  heroin: number;
  lastSettledAt: Date;
  lastRaidCheckAt: Date;
  incomeAccrued: number;
  raided: boolean;
  raidLosses?: {
    cashSeized: number;
    drugsSeized: BusinessDrugInventory;
  };
  heatBand: string;
}

export function settleBusinessState(
  row: Business,
  now: Date = new Date(),
  raidRoll?: number,
): SettledBusinessState {
  const income = settleBusinessIncome({
    businessType: row.businessType,
    assignedWorkers: row.assignedWorkers,
    safeCash: row.safeCash,
    lastSettledAt: row.lastSettledAt,
    now,
  });

  let safeCash = income.safeCash;
  let hash = row.hash;
  let shrooms = row.shrooms;
  let coke = row.coke;
  let heroin = row.heroin;
  let lastRaidCheckAt = row.lastRaidCheckAt;

  const stored = { hash, shrooms, coke, heroin };
  const heat = evaluateBusinessHeat({
    businessType: row.businessType,
    assignedWorkers: row.assignedWorkers,
    safeCash,
    stored,
  });

  const raid = resolveBusinessRaidCheck({
    businessId: row.id,
    heat,
    safeCash,
    stored,
    lastRaidCheckAt: row.lastRaidCheckAt,
    now,
    roll: raidRoll,
  });

  let raided = false;
  let raidLosses: SettledBusinessState['raidLosses'];

  if (raid.checked) {
    lastRaidCheckAt = raid.nextLastRaidCheckAt;
  }

  if (raid.raided) {
    raided = true;
    safeCash = Math.max(0, safeCash - raid.losses.cashSeized);
    hash = Math.max(0, hash - raid.losses.drugsSeized.hash);
    shrooms = Math.max(0, shrooms - raid.losses.drugsSeized.shrooms);
    coke = Math.max(0, coke - raid.losses.drugsSeized.coke);
    heroin = Math.max(0, heroin - raid.losses.drugsSeized.heroin);
    raidLosses = raid.losses;
  }

  return {
    safeCash,
    hash,
    shrooms,
    coke,
    heroin,
    lastSettledAt: income.lastSettledAt,
    lastRaidCheckAt,
    incomeAccrued: income.incomeAccrued,
    raided,
    raidLosses,
    heatBand: heat.label,
  };
}

function formatDrugLosses(losses: BusinessDrugInventory): string {
  const parts: string[] = [];
  if (losses.hash > 0) parts.push(`${losses.hash.toLocaleString()} Hash`);
  if (losses.shrooms > 0) parts.push(`${losses.shrooms.toLocaleString()} Shrooms`);
  if (losses.coke > 0) parts.push(`${losses.coke.toLocaleString()} Coke`);
  if (losses.heroin > 0) parts.push(`${losses.heroin.toLocaleString()} Heroin`);
  return parts.length > 0 ? parts.join('\n') : 'None';
}

async function recordPoliceRaidReport(
  tx: PrismaTransactionClient,
  row: Business,
  settlement: SettledBusinessState,
): Promise<void> {
  if (!settlement.raided || !settlement.raidLosses) return;

  const losses = settlement.raidLosses;
  const drugLines = formatDrugLosses(losses.drugsSeized);
  const body = [
    `Cash seized: $${losses.cashSeized.toLocaleString()}`,
    drugLines !== 'None' ? `Drugs seized:\n${drugLines}` : 'Drugs seized: None',
    `Heat at raid: ${settlement.heatBand}`,
    '',
    'Business remains operational.',
  ].join('\n');

  await tx.report.create({
    data: {
      playerId: row.playerId,
      category: 'SYSTEM',
      title: 'Police Raid',
      summary: `${row.name} was raided by authorities.`,
      body,
      metadata: {
        type: 'POLICE_RAID',
        businessId: row.id,
        businessName: row.name,
        heatBand: settlement.heatBand,
        cashSeized: losses.cashSeized,
        drugsSeized: { ...losses.drugsSeized },
      } as object,
    },
  });

  await tx.playerStatusExt.upsert({
    where: { playerId: row.playerId },
    create: { playerId: row.playerId, unreadReports: 1 },
    update: { unreadReports: { increment: 1 } },
  });
}

export async function settleBusinessInTransaction(
  tx: PrismaTransactionClient,
  businessId: string,
  now: Date = new Date(),
): Promise<{ row: Business; settlement: SettledBusinessState }> {
  const row = await tx.business.findUniqueOrThrow({ where: { id: businessId } });
  const settlement = settleBusinessState(row, now);

  const updated = await tx.business.update({
    where: { id: businessId },
    data: {
      safeCash: settlement.safeCash,
      hash: settlement.hash,
      shrooms: settlement.shrooms,
      coke: settlement.coke,
      heroin: settlement.heroin,
      lastSettledAt: settlement.lastSettledAt,
      lastRaidCheckAt: settlement.lastRaidCheckAt,
    },
  });

  await recordPoliceRaidReport(tx, updated, settlement);

  return { row: updated, settlement };
}

export function toBusinessViewModel(
  row: Business,
  districtName: string,
): BusinessViewModel {
  const rule = getBusinessTypeRule(row.businessType);
  const stored = businessStoredDrugs(row);
  const heat = evaluateBusinessHeat({
    businessType: row.businessType,
    assignedWorkers: row.assignedWorkers,
    safeCash: row.safeCash,
    stored,
  });
  const storedDrugUnits = businessStoredTotal(row);

  return {
    id: row.id,
    businessType: row.businessType,
    displayName: rule.displayName,
    name: row.name,
    districtId: row.districtId,
    districtName,
    purchasePrice: row.purchasePrice,
    streetNwContribution: businessStreetNwContribution(row.purchasePrice),
    assignedWorkers: row.assignedWorkers,
    safeCash: row.safeCash,
    safeCapacity: rule.safeCapacity,
    safeFull: row.safeCash >= rule.safeCapacity,
    hourlyIncome: businessHourlyIncome(row.businessType, row.assignedWorkers),
    storedDrugs: stored,
    storedDrugUnits,
    drugStorageCapacity: rule.drugStorageCapacity,
    heatScore: heat.score,
    heatBand: heat.band,
    heatLabel: heat.label,
    createdAt: row.createdAt.toISOString(),
  };
}

export function buildPortfolioSummary(
  streetWorkers: number,
  businesses: BusinessViewModel[],
): BusinessPortfolioSummary {
  const heatScores = businesses.map((b) => b.heatScore);
  const nw = aggregateBusinessNwContext(
    businesses.map((b) => ({
      purchasePrice: b.purchasePrice,
      assignedWorkers: b.assignedWorkers,
    })),
  );

  return {
    ownedCount: businesses.length,
    streetWorkers,
    assignedWorkers: nw.assignedWorkers,
    totalSafeCash: businesses.reduce((sum, b) => sum + b.safeCash, 0),
    totalStoredDrugs: businesses.reduce((sum, b) => sum + b.storedDrugUnits, 0),
    overallHeatBand: overallHeatBand(heatScores),
    businessStreetAssets: nw.businessStreetAssets,
  };
}

export async function countPlayerBusinessesByType(
  tx: PrismaTransactionClient,
  playerId: string,
  businessType: BusinessType,
): Promise<number> {
  return tx.business.count({ where: { playerId, businessType } });
}

export async function nextBusinessSequence(
  tx: PrismaTransactionClient,
  playerId: string,
  businessType: BusinessType,
): Promise<number> {
  const count = await countPlayerBusinessesByType(tx, playerId, businessType);
  return count + 1;
}

export function assertBusinessDrugKey(key: string): key is BusinessDrugKey {
  return (BUSINESS_DRUG_KEYS as readonly string[]).includes(key);
}

export function validatePurchase(
  player: { cash: number; lifeStatus: string; travelling: boolean },
  ownedCount: number,
  businessType: BusinessType,
): string | null {
  if (player.lifeStatus !== 'ACTIVE') return 'Business purchases unavailable in your current status.';
  if (player.travelling) return 'Business purchases unavailable while travelling.';
  if (ownedCount >= MAX_BUSINESSES_PER_PLAYER) {
    return `You can own at most ${MAX_BUSINESSES_PER_PLAYER} businesses.`;
  }
  const price = businessPurchasePrice(businessType);
  if (player.cash < price) return 'Insufficient cash.';
  return null;
}

export function validateAssignWorkers(streetWorkers: number, quantity: number): string | null {
  if (!Number.isInteger(quantity) || quantity < 1) return 'Enter a valid number of Workers.';
  if (quantity > streetWorkers) return `You only have ${streetWorkers.toLocaleString()} street Workers available.`;
  return null;
}

export function validateRemoveWorkers(assigned: number, quantity: number): string | null {
  if (!Number.isInteger(quantity) || quantity < 1) return 'Enter a valid number of Workers.';
  if (quantity > assigned) return `Only ${assigned.toLocaleString()} Workers assigned here.`;
  return null;
}

export function validateDrugTransfer(
  playerQty: number,
  businessStored: number,
  capacity: number,
  quantity: number,
): string | null {
  if (!Number.isInteger(quantity) || quantity < 1) return 'Enter a valid quantity.';
  if (quantity > playerQty) return 'Insufficient street inventory.';
  if (businessStored + quantity > capacity) return 'Business drug storage is full.';
  return null;
}

export function validateDrugWithdraw(stored: number, quantity: number): string | null {
  if (!Number.isInteger(quantity) || quantity < 1) return 'Enter a valid quantity.';
  if (quantity > stored) return 'Insufficient stored quantity.';
  return null;
}

export function businessNameForPurchase(
  businessType: BusinessType,
  sequence: number,
): string {
  return defaultBusinessName(businessType, sequence);
}

export type BusinessUpdateData = Prisma.BusinessUpdateInput;
