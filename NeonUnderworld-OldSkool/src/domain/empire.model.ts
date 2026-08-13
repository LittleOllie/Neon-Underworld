import type { ActivityItem } from '@local/domain/player.model';
import type { StatusMeterPresentation } from '@local/server/domain/status-presentation';

export interface ActivitySummary {
  id: string;
  category: string;
  message: string;
  createdAt: Date;
}

export interface EmpireManagementData {
  player: {
    id: string;
    alias: string;
    city: string;
    cartelId: string | null;
    cash: number;
    bankCash: number;
    netWorth: number;
    turns: number;
    turnCap: number;
    health: number;
    protectionStatus: string;
    lifeStatus: string;
    travelling: boolean;
    travelDestination: string | null;
    rank: number;
  };

  personnel: {
    /** Street workers (Scout/Produce). */
    thugs: number;
    workers: number;
    streetWorkers: number;
    streetThugs: number;
    businessWorkers: number;
    businessSecurity: number;
    totalWorkers: number;
    totalThugs: number;
    workerPayoutPercent: number;
    estimatedWorkerMorale: number;
    armedThugs: number;
    unarmedThugs: number;
  };

  weapons: {
    totalWeapons: number;
    usableWeapons: number;
    surplusWeapons: number;
    shortage: number;
    byType: Array<{
      key: string;
      name: string;
      quantity: number;
      combatValue: number;
    }>;
  };

  vehicles: {
    totalVehicles: number;
    totalCapacity: number;
    occupiedCapacity: number;
    availableCapacity: number;
    byType: Array<{
      key: string;
      name: string;
      quantity: number;
      capacityEach: number;
      totalCapacity: number;
    }>;
  };

  drugs: {
    totalUnits: number;
    estimatedValue: number;
    byType: Array<{
      key: string;
      name: string;
      quantity: number;
      valuationEach: number;
    }>;
  };

  businesses: {
    total: number;
    estimatedValue: number;
    incomeActive: boolean;
    byType: Array<{
      key: string;
      name: string;
      quantity: number;
      valueEach: number;
    }>;
  };

  businessOperations?: {
    owned: number;
    maxOwned?: number;
    assignedWorkers: number;
    assignedSecurityThugs?: number;
    safeBalance: number;
    totalStoredDrugs?: number;
    safeFullCount?: number;
    overCapacityCount?: number;
    criticalHeatCount?: number;
    overallHeat: string;
    overallHeatScore: number;
    sites: Array<{
      id: string;
      name: string;
      heatScore: number;
      heatBand: string;
      heatLabel: string;
    }>;
  } | null;

  finances: {
    cash: number;
    bankCash: number;
    liquidTotal: number;
    netWorth: number;
    estimatedIncomePerCycle: number | null;
    estimatedExpensesPerCycle: number | null;
  };

  readiness: {
    productionReady: boolean;
    attackReady: boolean;
    travelReady: boolean;
    marketReady: boolean;
    warningCount: number;
    reasons: string[];
    details: {
      production: ReadinessDetail;
      attack: ReadinessDetail;
      travel: ReadinessDetail;
      market: ReadinessDetail;
    };
  };

  supplySummary: {
    workers: {
      status: string;
      hash: string;
      condoms: string;
      protection: string;
      payout: string;
    };
    thugs: {
      status: string;
      weapons: string;
      beer: string;
      armed: string;
    };
  };

  statusMeters: {
    worker: {
      stability: StatusMeterPresentation;
      supplies: StatusMeterPresentation;
      protection: StatusMeterPresentation;
      payout: StatusMeterPresentation;
    };
    thug: {
      stability: StatusMeterPresentation;
      weaponCoverage: StatusMeterPresentation;
      beer: StatusMeterPresentation;
    };
  };

  recentActivity: ActivitySummary[];
}

export interface ReadinessDetail {
  ready: boolean;
  label: string;
  status: string;
  notes: string[];
}

export interface CommandEmpireBrief {
  armedThugs: number;
  unarmedThugs: number;
  bankCash: number;
  readinessWarningCount: number;
}

export function toActivitySummary(item: ActivityItem): ActivitySummary {
  return {
    id: item.id,
    category: item.category,
    message: item.message,
    createdAt: item.createdAt,
  };
}
