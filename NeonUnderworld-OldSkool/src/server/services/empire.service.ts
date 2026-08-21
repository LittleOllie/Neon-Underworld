import { prisma } from '@core/lib/db/prisma';
import type { EmpireSummary } from '@local/domain/player.model';
import type { CommandEmpireBrief, EmpireManagementData } from '@local/domain/empire.model';
import { NetWorthService } from './net-worth.service';
import { TurnService } from './turn.service';
import { RankingsService } from './rankings.service';
import type { CanonicalPlayerContext } from './player.service';
import {
  buildBusinessesBreakdown,
  buildDrugsBreakdown,
  buildEmpireSupplySummary,
  buildPreferredCrewSupplies,
  buildVehiclesBreakdown,
  buildWeaponsBreakdown,
  calculateOperationalReadiness,
  estimateWorkerMorale,
  type PlayerInventoryRow,
} from '@local/server/domain/empire-calculations';
import { buildEmpireStatusMeters } from '@local/server/domain/status-presentation';
import { getBusinessEmpireSummary } from '@core/server/services/business-portfolio.service';

function buildPersonnelBreakdown(
  inventory: PlayerInventoryRow,
  weapons: ReturnType<typeof buildWeaponsBreakdown>,
  morale: number,
  businessOperations: Awaited<ReturnType<typeof getBusinessEmpireSummary>> | null,
): EmpireManagementData['personnel'] {
  const streetWorkers = inventory.prostitutes;
  const streetThugs = inventory.thugs;
  const businessWorkers = businessOperations?.assignedWorkers ?? 0;
  const businessSecurity = businessOperations?.assignedSecurityThugs ?? 0;

  return {
    thugs: streetThugs,
    workers: streetWorkers,
    streetWorkers,
    streetThugs,
    businessWorkers,
    businessSecurity,
    totalWorkers: streetWorkers + businessWorkers,
    totalThugs: streetThugs + businessSecurity,
    workerPayoutPercent: inventory.prostitutePayoutPercent,
    estimatedWorkerMorale: morale,
    armedThugs: weapons.armedThugs,
    unarmedThugs: weapons.unarmedThugs,
  };
}

type AggregateInput = {
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
};

function aggregateFromPlayer(player: AggregateInput): EmpireSummary {
  return {
    thugs: player.thugs,
    workers: player.prostitutes,
    weapons: player.glocks + player.uzis + player.aks,
    vehicles: player.rides,
    drugs: player.hash + player.shrooms + player.coke + player.heroin,
    businesses: player.businesses,
  };
}

function toInventoryRow(
  player: Awaited<ReturnType<typeof loadPlayerForManagement>>,
): PlayerInventoryRow {
  return {
    thugs: player.thugs,
    prostitutes: player.prostitutes,
    glocks: player.glocks,
    uzis: player.uzis,
    aks: player.aks,
    rides: player.rides,
    hash: player.hash,
    shrooms: player.shrooms,
    coke: player.coke,
    heroin: player.heroin,
    businesses: player.businesses,
    condoms: player.condoms,
    beer: player.beer,
    prostitutePayoutPercent: player.prostitutePayoutPercent,
  };
}

async function loadPlayerForManagement(playerId: string) {
  return prisma.player.findUniqueOrThrow({
    where: { id: playerId },
    include: {
      district: true,
      turnState: true,
    },
  });
}

function inventoryFromContext(ctx: CanonicalPlayerContext): PlayerInventoryRow {
  return {
    thugs: ctx.thugs,
    prostitutes: ctx.prostitutes,
    glocks: ctx.glocks,
    uzis: ctx.uzis,
    aks: ctx.aks,
    rides: ctx.rides,
    hash: ctx.hash,
    shrooms: ctx.shrooms,
    coke: ctx.coke,
    heroin: ctx.heroin,
    businesses: ctx.businesses,
    condoms: ctx.condoms,
    beer: ctx.beer,
    prostitutePayoutPercent: ctx.prostitutePayoutPercent,
  };
}

export const EmpireService = {
  aggregateFromPlayer,

  async getSummary(playerId: string): Promise<EmpireSummary> {
    const player = await prisma.player.findUniqueOrThrow({ where: { id: playerId } });
    return aggregateFromPlayer(player);
  },

  async syncInventory(playerId: string): Promise<EmpireSummary> {
    const player = await prisma.player.findUniqueOrThrow({ where: { id: playerId } });
    const totals = aggregateFromPlayer(player);

    await prisma.playerInventory.upsert({
      where: { playerId },
      create: { playerId, ...totals },
      update: { ...totals },
    });

    return totals;
  },

  async getStoredSummary(playerId: string): Promise<EmpireSummary> {
    const row = await prisma.playerInventory.findUnique({ where: { playerId } });
    if (row) {
      return {
        thugs: row.thugs,
        workers: row.workers,
        weapons: row.weapons,
        vehicles: row.vehicles,
        drugs: row.drugs,
        businesses: row.businesses,
      };
    }
    return this.syncInventory(playerId);
  },

  buildCommandBrief(ctx: CanonicalPlayerContext): CommandEmpireBrief {
    const row = {
      thugs: ctx.thugs,
      prostitutes: ctx.prostitutes,
      glocks: ctx.glocks,
      uzis: ctx.uzis,
      aks: ctx.aks,
      rides: ctx.rides,
      hash: ctx.hash,
      shrooms: ctx.shrooms,
      coke: ctx.coke,
      heroin: ctx.heroin,
      businesses: ctx.businesses,
      condoms: ctx.condoms,
      beer: ctx.beer,
      prostitutePayoutPercent: ctx.prostitutePayoutPercent,
    };
    const weapons = buildWeaponsBreakdown(row);
    const vehicles = buildVehiclesBreakdown(row);
    const drugs = buildDrugsBreakdown(row);
    const readiness = calculateOperationalReadiness({
      workers: ctx.prostitutes,
      thugs: ctx.thugs,
      turns: ctx.turns,
      usableWeapons: weapons.usableWeapons,
      totalVehicles: vehicles.totalVehicles,
      totalCapacity: vehicles.totalCapacity,
      drugUnits: drugs.totalUnits,
      weaponCount: weapons.totalWeapons,
      lifeStatus: ctx.lifeStatus,
      travelling: ctx.travelling,
      unarmedThugs: weapons.unarmedThugs,
    });

    return {
      armedThugs: weapons.armedThugs,
      unarmedThugs: weapons.unarmedThugs,
      bankCash: ctx.bankCash,
      readinessWarningCount: readiness.warningCount,
    };
  },

  async getManagementDataFromContext(ctx: CanonicalPlayerContext): Promise<EmpireManagementData> {
    const inventory = inventoryFromContext(ctx);
    const netWorth = ctx.netWorth;
    const weapons = buildWeaponsBreakdown(inventory);
    const vehicles = buildVehiclesBreakdown(inventory);
    const drugs = buildDrugsBreakdown(inventory);
    const businesses = buildBusinessesBreakdown(inventory);
    const businessOperations = await getBusinessEmpireSummary(ctx.id).catch(() => null);
    const morale = estimateWorkerMorale(inventory);
    const supplySummary = buildEmpireSupplySummary(inventory);
    const preferredSupplies = buildPreferredCrewSupplies(inventory);
    const readiness = calculateOperationalReadiness({
      workers: inventory.prostitutes,
      thugs: inventory.thugs,
      turns: ctx.turns,
      usableWeapons: weapons.usableWeapons,
      totalVehicles: vehicles.totalVehicles,
      totalCapacity: vehicles.totalCapacity,
      drugUnits: drugs.totalUnits,
      weaponCount: weapons.totalWeapons,
      lifeStatus: ctx.lifeStatus,
      travelling: ctx.travelling,
      unarmedThugs: weapons.unarmedThugs,
    });

    const liquidTotal = ctx.cash + ctx.bankCash;

    return {
      player: {
        id: ctx.id,
        alias: ctx.alias,
        city: ctx.district.name,
        cartelId: ctx.cartelId,
        cash: ctx.cash,
        bankCash: ctx.bankCash,
        netWorth,
        turns: ctx.turns,
        turnCap: ctx.turnCap,
        health: ctx.health,
        protectionStatus: ctx.protectionStatus,
        lifeStatus: ctx.lifeStatus,
        travelling: ctx.travelling,
        travelDestination: ctx.travelDestination,
        rank: ctx.rank,
      },
      personnel: buildPersonnelBreakdown(inventory, weapons, morale, businessOperations),
      weapons: {
        totalWeapons: weapons.totalWeapons,
        usableWeapons: weapons.usableWeapons,
        surplusWeapons: weapons.surplusWeapons,
        shortage: weapons.shortage,
        byType: weapons.byType,
      },
      vehicles,
      drugs,
      businesses: {
        ...businesses,
        total: businessOperations?.owned ?? businesses.total,
        incomeActive: (businessOperations?.owned ?? 0) > 0,
      },
      businessOperations,
      finances: {
        cash: ctx.cash,
        bankCash: ctx.bankCash,
        liquidTotal,
        netWorth,
        estimatedIncomePerCycle: null,
        estimatedExpensesPerCycle: null,
      },
      readiness,
      supplySummary,
      preferredSupplies,
      statusMeters: buildEmpireStatusMeters(inventory),
      recentActivity: [],
    };
  },

  async getManagementData(playerId: string): Promise<EmpireManagementData> {
    const player = await loadPlayerForManagement(playerId);
    if (!player.turnState) {
      throw new Error('Player turn state missing');
    }

    const settled = TurnService.settle({
      currentTurns: player.turnState.currentTurns,
      lastRegeneratedAt: player.turnState.lastRegeneratedAt,
      turnCap: player.turnState.turnCap,
      regenerationRatePerMs: player.turnState.regenerationRate,
    });

    const inventory = toInventoryRow(player);
    const netWorth = await NetWorthService.calculateFromPlayerAsync(player);
    const weapons = buildWeaponsBreakdown(inventory);
    const vehicles = buildVehiclesBreakdown(inventory);
    const drugs = buildDrugsBreakdown(inventory);
    const businesses = buildBusinessesBreakdown(inventory);
    const businessOperations = await getBusinessEmpireSummary(playerId).catch(() => null);
    const morale = estimateWorkerMorale(inventory);
    const supplySummary = buildEmpireSupplySummary(inventory);
    const preferredSupplies = buildPreferredCrewSupplies(inventory);
    const readiness = calculateOperationalReadiness({
      workers: inventory.prostitutes,
      thugs: inventory.thugs,
      turns: settled.currentTurns,
      usableWeapons: weapons.usableWeapons,
      totalVehicles: vehicles.totalVehicles,
      totalCapacity: vehicles.totalCapacity,
      drugUnits: drugs.totalUnits,
      weaponCount: weapons.totalWeapons,
      lifeStatus: player.lifeStatus,
      travelling: player.travelling,
      unarmedThugs: weapons.unarmedThugs,
    });

    const rank = await RankingsService.getPlayerDistrictRank(
      playerId,
      player.seasonId,
      player.district.slug,
    );

    const liquidTotal = player.cash + player.bankCash;

    return {
      player: {
        id: player.id,
        alias: player.alias,
        city: player.district.name,
        cartelId: player.cartelId,
        cash: player.cash,
        bankCash: player.bankCash,
        netWorth,
        turns: settled.currentTurns,
        turnCap: settled.turnCap,
        health: player.health,
        protectionStatus: player.protectionStatus,
        lifeStatus: player.lifeStatus,
        travelling: player.travelling,
        travelDestination: player.travelDestination,
        rank,
      },
      personnel: buildPersonnelBreakdown(inventory, weapons, morale, businessOperations),
      weapons: {
        totalWeapons: weapons.totalWeapons,
        usableWeapons: weapons.usableWeapons,
        surplusWeapons: weapons.surplusWeapons,
        shortage: weapons.shortage,
        byType: weapons.byType,
      },
      vehicles,
      drugs,
      businesses: {
        ...businesses,
        total: businessOperations?.owned ?? businesses.total,
        incomeActive: (businessOperations?.owned ?? 0) > 0,
      },
      businessOperations,
      finances: {
        cash: player.cash,
        bankCash: player.bankCash,
        liquidTotal,
        netWorth,
        estimatedIncomePerCycle: null,
        estimatedExpensesPerCycle: null,
      },
      readiness,
      supplySummary,
      preferredSupplies,
      statusMeters: buildEmpireStatusMeters(inventory),
      recentActivity: [],
    };
  },
};
