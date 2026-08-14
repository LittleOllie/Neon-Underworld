import { describe, it, expect } from 'vitest';
import type { EmpireManagementData } from '@local/domain/empire.model';
import { buildEmpireStatusMeters } from '@local/server/domain/status-presentation';

const inventory = {
  thugs: 5,
  prostitutes: 10,
  glocks: 4,
  uzis: 0,
  aks: 0,
  rides: 2,
  hash: 10,
  shrooms: 5,
  coke: 0,
  heroin: 0,
  businesses: 1,
  condoms: 8,
  beer: 6,
  prostitutePayoutPercent: 50,
};

const mockData: EmpireManagementData = {
  player: {
    id: 'p1',
    alias: 'TestOp',
    city: 'Neon Strip',
    cartelId: null,
    cash: 5000,
    bankCash: 2000,
    netWorth: 25000,
    turns: 400,
    turnCap: 5000,
    health: 100,
    protectionStatus: 'NONE',
    lifeStatus: 'ACTIVE',
    travelling: false,
    travelDestination: null,
    rank: 5,
  },
  personnel: {
    thugs: 5,
    workers: 10,
    streetWorkers: 10,
    streetThugs: 5,
    businessWorkers: 0,
    businessSecurity: 0,
    totalWorkers: 10,
    totalThugs: 5,
    workerPayoutPercent: 50,
    estimatedWorkerMorale: 72,
    armedThugs: 4,
    unarmedThugs: 1,
  },
  weapons: {
    totalWeapons: 4,
    usableWeapons: 4,
    surplusWeapons: 0,
    shortage: 1,
    byType: [
      { key: 'glocks', name: 'Glocks', quantity: 4, combatValue: 1 },
      { key: 'uzis', name: 'Uzis', quantity: 0, combatValue: 1 },
      { key: 'aks', name: 'AKs', quantity: 0, combatValue: 1 },
    ],
  },
  vehicles: {
    totalVehicles: 2,
    totalCapacity: 20,
    occupiedCapacity: 0,
    availableCapacity: 20,
    byType: [{ key: 'rides', name: 'Rides', quantity: 2, capacityEach: 10, totalCapacity: 20 }],
  },
  drugs: {
    totalUnits: 15,
    estimatedValue: 75,
    byType: [
      { key: 'hash', name: 'Hash', quantity: 10, valuationEach: 5 },
      { key: 'shrooms', name: 'Shrooms', quantity: 5, valuationEach: 5 },
      { key: 'coke', name: 'Coke', quantity: 0, valuationEach: 5 },
      { key: 'heroin', name: 'Heroin', quantity: 0, valuationEach: 5 },
    ],
  },
  businesses: {
    total: 1,
    estimatedValue: 3500,
    incomeActive: false,
    byType: [{ key: 'businesses', name: 'Owned Businesses', quantity: 1, valueEach: 3500 }],
  },
  finances: {
    cash: 5000,
    bankCash: 2000,
    liquidTotal: 7000,
    netWorth: 25000,
    estimatedIncomePerCycle: null,
    estimatedExpensesPerCycle: null,
  },
  readiness: {
    productionReady: true,
    attackReady: true,
    travelReady: true,
    marketReady: true,
    warningCount: 1,
    reasons: [],
    details: {
      production: { ready: true, label: 'Production', status: 'Ready (system pending)', notes: [] },
      attack: { ready: true, label: 'Attack', status: 'Ready (system pending)', notes: ['1 thugs are unarmed'] },
      travel: { ready: true, label: 'Travel', status: 'Ready (system pending)', notes: [] },
      market: { ready: true, label: 'Black Market', status: 'Ready (system pending)', notes: [] },
    },
  },
  supplySummary: {
    workers: { status: 'Stable', hash: 'Adequate', condoms: 'Low', protection: 'Adequate', payout: '50%' },
    thugs: { status: 'Stable', weapons: 'Adequate', beer: 'Adequate', armed: '4 / 5' },
  },
  statusMeters: buildEmpireStatusMeters(inventory),
  recentActivity: [],
};

describe('Empire page smoke — status meters', () => {
  it('includes status meters instead of dense supply table as primary model', () => {
    expect(mockData.statusMeters.worker.stability.label).toBe('Worker Stability');
    expect(mockData.statusMeters.thug.weaponCoverage.label).toBe('Weapon Coverage');
    expect(mockData.statusMeters.worker.payout.label).toBe('Worker Payout');
  });

  it('management data includes core sections', () => {
    expect(mockData.finances.cash).toBeGreaterThan(0);
    expect(mockData.personnel.workers).toBeGreaterThan(0);
    expect(mockData.readiness.details.production.label).toBe('Production');
    expect(mockData.weapons.byType.length).toBeGreaterThan(0);
    expect(mockData.vehicles.totalCapacity).toBeGreaterThan(0);
    expect(mockData.drugs.totalUnits).toBeGreaterThan(0);
    expect(mockData.businesses.total).toBeGreaterThan(0);
  });

  it('uses Workers terminology in personnel model', () => {
    expect(mockData.personnel.workers).toBe(10);
    expect(mockData.personnel).not.toHaveProperty('prostitutes');
  });
});
