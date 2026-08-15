import type { Business, BusinessType, Prisma } from '@prisma/client';
import {
  BUSINESS_DRUG_KEYS,
  businessHourlyIncome,
  businessPurchasePrice,
  defaultBusinessName,
  getBusinessInvestedValueForState,
  getBusinessLevelStats,
  getBusinessStreetNwAssetForState,
  getBusinessTypeRule,
  getBusinessUpgradeCost,
  getBusinessUpgradeDurationMs,
  getBusinessUpgradeDurationLabel,
  isBusinessUpgrading,
  isSecurityOverCapacity,
  isWorkerOverCapacity,
  MAX_BUSINESSES_PER_PLAYER,
  type BusinessDrugKey,
} from '@/config/game/business-rules';
import { MAX_BUSINESS_LEVEL, type BusinessLevelStats } from '@/config/game/business-levels';
import {
  calculateBusinessNetworkBonus,
  getBusinessTierRecruitmentContribution,
} from '@/config/game/business-recruitment-rules';
import { evaluateBusinessHeat, overallHeatBand } from '@/lib/game-engine/business/heat';
import { resolveBusinessRaidCheck } from '@/lib/game-engine/business/raids';
import { settleBusinessIncome } from '@/lib/game-engine/business/settlement';
import {
  securityCoverage,
  securityRaidChanceMultiplier,
  securityRaidLossMultiplier,
  securityStatusBand,
  type SecurityStatusBand,
} from '@/lib/game-engine/business/security';
import type { PrismaTransactionClient } from '@/lib/db/serializable-transaction';

export type BusinessRecord = Business;

export const BUSINESS_NW_SELECT = {
  businessType: true,
  level: true,
  upgradeTargetLevel: true,
  assignedWorkers: true,
  assignedThugs: true,
} as const;

export type BusinessNwSelect = Pick<Business, keyof typeof BUSINESS_NW_SELECT>;

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
  level: number;
  purchasePrice: number;
  investedValue: number;
  streetNwContribution: number;
  assignedWorkers: number;
  workerCapacity: number;
  workerOverCapacity: boolean;
  assignedThugs: number;
  securityCapacity: number;
  securityOverCapacity: boolean;
  securityCoverage: number;
  securityBand: SecurityStatusBand;
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
  isUpgrading: boolean;
  upgradeTargetLevel?: number | null;
  upgradeStartedAt?: string;
  upgradeCompletesAt?: string;
  upgradeRemainingMs?: number;
  nextUpgradeDurationLabel?: string;
  nextUpgradeLevel?: number;
  nextUpgradeCost?: number;
  workerRecruitmentContribution: number;
  thugRecruitmentContribution: number;
  createdAt: string;
}

export interface BusinessPortfolioSummary {
  ownedCount: number;
  streetWorkers: number;
  assignedWorkers: number;
  totalSafeCash: number;
  totalStoredDrugs: number;
  totalInvested: number;
  overallHeatBand: string;
  businessStreetAssets: number;
  totalWorkerCapacity: number;
  workerRecruitmentBonusPercent: number;
  thugRecruitmentBonusPercent: number;
}

export interface BusinessUpgradePreview {
  fromLevel: number;
  toLevel: number;
  cost: number;
  currentStats: BusinessLevelStats;
  stats: BusinessLevelStats;
  currentWorkerRecruitment: number;
  currentThugRecruitment: number;
  nextWorkerRecruitment: number;
  nextThugRecruitment: number;
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

export function aggregateBusinessNwContext(businesses: BusinessNwSelect[]) {
  const assignedWorkers = businesses.reduce((sum, b) => sum + b.assignedWorkers, 0);
  const assignedSecurityThugs = businesses.reduce((sum, b) => sum + b.assignedThugs, 0);
  const businessStreetAssets = businesses.reduce(
    (sum, b) =>
      sum +
      getBusinessStreetNwAssetForState({
        businessType: b.businessType,
        level: b.level,
        upgradeTargetLevel: b.upgradeTargetLevel,
      }),
    0,
  );
  return { assignedWorkers, assignedSecurityThugs, businessStreetAssets };
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
  securityBand: SecurityStatusBand;
}

export function settleBusinessState(
  row: Business,
  now: Date = new Date(),
  raidRoll?: number,
): SettledBusinessState {
  const levelStats = getBusinessLevelStats(row.businessType, row.level);
  const coverage = securityCoverage(row.assignedThugs, levelStats.securityCapacity);
  const securityBand = securityStatusBand(coverage);

  const income = settleBusinessIncome({
    businessType: row.businessType,
    level: row.level,
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
    level: row.level,
    assignedWorkers: row.assignedWorkers,
    assignedThugs: row.assignedThugs,
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
    raidChanceMultiplier: securityRaidChanceMultiplier(coverage, levelStats),
    raidLossMultiplier: securityRaidLossMultiplier(coverage, levelStats),
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
    securityBand,
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
    `Security at raid: ${settlement.securityBand}`,
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
        securityBand: settlement.securityBand,
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

async function recordUpgradeCompleteReport(
  tx: PrismaTransactionClient,
  row: Business,
  fromLevel: number,
  toLevel: number,
): Promise<void> {
  const before = getBusinessLevelStats(row.businessType, fromLevel);
  const after = getBusinessLevelStats(row.businessType, toLevel);
  const body = [
    `${row.name} is now Level ${toLevel}.`,
    '',
    `Worker capacity: ${before.workerCapacity.toLocaleString()} → ${after.workerCapacity.toLocaleString()}`,
    `Safe: $${before.safeCapacity.toLocaleString()} → $${after.safeCapacity.toLocaleString()}`,
    `Storage: ${before.drugStorageCapacity.toLocaleString()} → ${after.drugStorageCapacity.toLocaleString()}`,
    `Security: ${before.securityCapacity} → ${after.securityCapacity}`,
  ].join('\n');

  await tx.report.create({
    data: {
      playerId: row.playerId,
      category: 'SYSTEM',
      title: 'Business Upgrade Complete',
      summary: `${row.name} reached Level ${toLevel}.`,
      body,
      metadata: {
        type: 'BUSINESS_UPGRADE_COMPLETE',
        businessId: row.id,
        businessName: row.name,
        fromLevel,
        toLevel,
      } as object,
    },
  });

  await tx.playerStatusExt.upsert({
    where: { playerId: row.playerId },
    create: { playerId: row.playerId, unreadReports: 1 },
    update: { unreadReports: { increment: 1 } },
  });
}

/** Lazy, idempotent upgrade finalization — call before settlement on every Business touch. */
export async function maybeCompleteBusinessUpgradeInTransaction(
  tx: PrismaTransactionClient,
  businessId: string,
  now: Date = new Date(),
): Promise<Business | null> {
  const row = await tx.business.findUnique({ where: { id: businessId } });
  if (!row || !isBusinessUpgrading(row)) return row;
  if (!row.upgradeCompletesAt || row.upgradeCompletesAt > now) return row;

  const targetLevel = row.upgradeTargetLevel!;
  const fromLevel = row.level;

  const updated = await tx.business.updateMany({
    where: {
      id: businessId,
      level: fromLevel,
      upgradeTargetLevel: targetLevel,
      upgradeCompletesAt: { lte: now },
    },
    data: {
      level: targetLevel,
      upgradeTargetLevel: null,
      upgradeStartedAt: null,
      upgradeCompletesAt: null,
    },
  });

  if (updated.count === 1) {
    const completed = await tx.business.findUniqueOrThrow({ where: { id: businessId } });
    await recordUpgradeCompleteReport(tx, completed, fromLevel, targetLevel);
    return completed;
  }

  return tx.business.findUnique({ where: { id: businessId } });
}

export async function settleBusinessInTransaction(
  tx: PrismaTransactionClient,
  businessId: string,
  now: Date = new Date(),
): Promise<{ row: Business; settlement: SettledBusinessState }> {
  await maybeCompleteBusinessUpgradeInTransaction(tx, businessId, now);
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
  now: Date = new Date(),
): BusinessViewModel {
  const rule = getBusinessTypeRule(row.businessType);
  const upgrading = isBusinessUpgrading(row);
  const functionalLevel = row.level;
  const levelStats = getBusinessLevelStats(row.businessType, functionalLevel);
  const stored = businessStoredDrugs(row);
  const coverage = securityCoverage(row.assignedThugs, levelStats.securityCapacity);
  const heat = evaluateBusinessHeat({
    businessType: row.businessType,
    level: functionalLevel,
    assignedWorkers: row.assignedWorkers,
    assignedThugs: row.assignedThugs,
    safeCash: row.safeCash,
    stored,
  });
  const storedDrugUnits = businessStoredTotal(row);
  const investmentState = {
    businessType: row.businessType,
    level: row.level,
    upgradeTargetLevel: row.upgradeTargetLevel,
  };
  const investedValue = getBusinessInvestedValueForState(investmentState);
  const recruitmentTier = getBusinessTierRecruitmentContribution(row.businessType, functionalLevel);
  const upgradeRemainingMs =
    upgrading && row.upgradeCompletesAt
      ? Math.max(0, row.upgradeCompletesAt.getTime() - now.getTime())
      : undefined;

  const view: BusinessViewModel = {
    id: row.id,
    businessType: row.businessType,
    displayName: rule.displayName,
    name: row.name,
    districtId: row.districtId,
    districtName,
    level: functionalLevel,
    purchasePrice: row.purchasePrice,
    investedValue,
    streetNwContribution: getBusinessStreetNwAssetForState(investmentState),
    assignedWorkers: row.assignedWorkers,
    workerCapacity: levelStats.workerCapacity,
    workerOverCapacity: isWorkerOverCapacity(row.assignedWorkers, levelStats.workerCapacity),
    assignedThugs: row.assignedThugs,
    securityCapacity: levelStats.securityCapacity,
    securityOverCapacity: isSecurityOverCapacity(row.assignedThugs, levelStats.securityCapacity),
    securityCoverage: coverage,
    securityBand: securityStatusBand(coverage),
    safeCash: row.safeCash,
    safeCapacity: levelStats.safeCapacity,
    safeFull: row.safeCash >= levelStats.safeCapacity,
    hourlyIncome: businessHourlyIncome(row.businessType, row.assignedWorkers, functionalLevel),
    storedDrugs: stored,
    storedDrugUnits,
    drugStorageCapacity: levelStats.drugStorageCapacity,
    heatScore: heat.score,
    heatBand: heat.band,
    heatLabel: heat.label,
    isUpgrading: upgrading,
    upgradeTargetLevel: row.upgradeTargetLevel,
    workerRecruitmentContribution: recruitmentTier.workerPercent,
    thugRecruitmentContribution: recruitmentTier.thugPercent,
    createdAt: row.createdAt.toISOString(),
  };

  if (upgrading && row.upgradeTargetLevel != null) {
    view.upgradeTargetLevel = row.upgradeTargetLevel;
    view.upgradeStartedAt = row.upgradeStartedAt?.toISOString();
    view.upgradeCompletesAt = row.upgradeCompletesAt?.toISOString();
    view.upgradeRemainingMs = upgradeRemainingMs;
  }

  if (!upgrading && functionalLevel < MAX_BUSINESS_LEVEL) {
    const targetLevel = functionalLevel + 1;
    view.nextUpgradeLevel = targetLevel;
    view.nextUpgradeCost = getBusinessUpgradeCost(row.businessType, targetLevel);
    view.nextUpgradeDurationLabel = getBusinessUpgradeDurationLabel(targetLevel);
  }

  return view;
}

export function buildPortfolioSummary(
  streetWorkers: number,
  businesses: BusinessViewModel[],
): BusinessPortfolioSummary {
  const heatScores = businesses.map((b) => b.heatScore);
  const nw = aggregateBusinessNwContext(
    businesses.map((b) => ({
      businessType: b.businessType,
      level: b.level,
      upgradeTargetLevel: b.upgradeTargetLevel ?? null,
      assignedWorkers: b.assignedWorkers,
      assignedThugs: b.assignedThugs,
    })),
  );

  const network = calculateBusinessNetworkBonus(
    businesses.map((b) => ({ businessType: b.businessType, level: b.level })),
  );

  return {
    ownedCount: businesses.length,
    streetWorkers,
    assignedWorkers: nw.assignedWorkers,
    totalSafeCash: businesses.reduce((sum, b) => sum + b.safeCash, 0),
    totalStoredDrugs: businesses.reduce((sum, b) => sum + b.storedDrugUnits, 0),
    totalInvested: businesses.reduce((sum, b) => sum + b.investedValue, 0),
    overallHeatBand: overallHeatBand(heatScores),
    businessStreetAssets: nw.businessStreetAssets,
    totalWorkerCapacity: network.totalWorkerCapacity,
    workerRecruitmentBonusPercent: network.workerBonusPercent,
    thugRecruitmentBonusPercent: network.thugBonusPercent,
  };
}

export function buildUpgradePreview(
  type: BusinessType,
  fromLevel: number,
): BusinessUpgradePreview | null {
  if (fromLevel >= MAX_BUSINESS_LEVEL) return null;
  const toLevel = fromLevel + 1;
  const currentRecruitment = getBusinessTierRecruitmentContribution(type, fromLevel);
  const nextRecruitment = getBusinessTierRecruitmentContribution(type, toLevel);
  return {
    fromLevel,
    toLevel,
    cost: getBusinessUpgradeCost(type, toLevel),
    currentStats: getBusinessLevelStats(type, fromLevel),
    stats: getBusinessLevelStats(type, toLevel),
    currentWorkerRecruitment: currentRecruitment.workerPercent,
    currentThugRecruitment: currentRecruitment.thugPercent,
    nextWorkerRecruitment: nextRecruitment.workerPercent,
    nextThugRecruitment: nextRecruitment.thugPercent,
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

export function validateAssignWorkers(
  streetWorkers: number,
  quantity: number,
  currentAssigned: number,
  workerCapacity: number,
): string | null {
  if (!Number.isInteger(quantity) || quantity < 1) return 'Enter a valid number of Workers.';
  if (quantity > streetWorkers) return `You only have ${streetWorkers.toLocaleString()} street Workers available.`;
  if (currentAssigned >= workerCapacity) {
    return `Worker capacity (${workerCapacity.toLocaleString()}) is full.`;
  }
  if (currentAssigned + quantity > workerCapacity) {
    const room = workerCapacity - currentAssigned;
    return `Only ${room.toLocaleString()} worker slots available (capacity ${workerCapacity.toLocaleString()}).`;
  }
  return null;
}

export function validateRemoveWorkers(assigned: number, quantity: number): string | null {
  if (!Number.isInteger(quantity) || quantity < 1) return 'Enter a valid number of Workers.';
  if (quantity > assigned) return `Only ${assigned.toLocaleString()} Workers assigned here.`;
  return null;
}

export function validateAssignSecurity(
  streetThugs: number,
  quantity: number,
  currentAssigned: number,
  securityCapacity: number,
): string | null {
  if (!Number.isInteger(quantity) || quantity < 1) return 'Enter a valid number of Thugs.';
  if (quantity > streetThugs) return `You only have ${streetThugs.toLocaleString()} street Thugs available.`;
  if (currentAssigned >= securityCapacity) {
    return `Security capacity (${securityCapacity.toLocaleString()}) is full.`;
  }
  if (currentAssigned + quantity > securityCapacity) {
    const room = securityCapacity - currentAssigned;
    return `Only ${room.toLocaleString()} security slots available (capacity ${securityCapacity.toLocaleString()}).`;
  }
  return null;
}

export function validateRemoveSecurity(assigned: number, quantity: number): string | null {
  if (!Number.isInteger(quantity) || quantity < 1) return 'Enter a valid number of Thugs.';
  if (quantity > assigned) return `Only ${assigned.toLocaleString()} Thugs assigned here.`;
  return null;
}

export function validateStartUpgrade(
  level: number,
  upgradeTargetLevel: number | null | undefined,
  cash: number,
  type: BusinessType,
): string | null {
  if (upgradeTargetLevel != null) return 'An upgrade is already in progress.';
  if (level >= MAX_BUSINESS_LEVEL) return 'Business is already at maximum level.';
  const cost = getBusinessUpgradeCost(type, level + 1);
  if (cash < cost) return 'Insufficient cash for upgrade.';
  return null;
}

/** @deprecated Use validateStartUpgrade */
export function validateUpgrade(
  level: number,
  cash: number,
  type: BusinessType,
): string | null {
  return validateStartUpgrade(level, null, cash, type);
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
