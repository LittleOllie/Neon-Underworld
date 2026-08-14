import { describe, it, expect } from 'vitest';
import {
  empireBusinessesOwned,
  empireDrugsHeaderBadge,
  empireGearHeaderBadge,
  empireStreetDrugUnits,
  empireWeaponCount,
  formatEmpireSummaryMoney,
} from './empire-helpers';
import type { EmpireManagementData } from '@local/domain/empire.model';

const baseWeapons: EmpireManagementData['weapons'] = {
  totalWeapons: 190,
  usableWeapons: 190,
  surplusWeapons: 0,
  shortage: 0,
  byType: [
    { key: 'glocks', name: 'Glocks', quantity: 112, combatValue: 1 },
    { key: 'uzis', name: 'Uzis', quantity: 50, combatValue: 1 },
    { key: 'aks', name: 'AKs', quantity: 28, combatValue: 1 },
  ],
};

const baseVehicles: EmpireManagementData['vehicles'] = {
  totalVehicles: 78,
  totalCapacity: 780,
  occupiedCapacity: 0,
  availableCapacity: 780,
  byType: [],
};

describe('empire-helpers', () => {
  it('formats summary money compactly', () => {
    expect(formatEmpireSummaryMoney(18_400_000)).toBe('$18.4M');
    expect(formatEmpireSummaryMoney(3_200_000)).toBe('$3.2M');
    expect(formatEmpireSummaryMoney(4500)).toBe('$4,500');
  });

  it('aggregates street drug units from inventory breakdown', () => {
    const drugs: EmpireManagementData['drugs'] = {
      totalUnits: 4457,
      estimatedValue: 0,
      byType: [
        { key: 'hash', name: 'Hash', quantity: 4000, valuationEach: 1 },
        { key: 'shrooms', name: 'Shrooms', quantity: 457, valuationEach: 1 },
        { key: 'coke', name: 'Coke', quantity: 0, valuationEach: 1 },
        { key: 'heroin', name: 'Heroin', quantity: 0, valuationEach: 1 },
      ],
    };
    expect(empireStreetDrugUnits(drugs)).toBe(4457);
    expect(empireDrugsHeaderBadge(4457)).toBe('4,457 STREET UNITS');
  });

  it('aggregates weapon count for gear header', () => {
    expect(empireWeaponCount(baseWeapons)).toBe(190);
    expect(empireGearHeaderBadge(baseWeapons, baseVehicles)).toBe('190 WEAPONS · 78 RIDES');
  });

  it('reads businesses owned from operations summary', () => {
    const data = {
      businessOperations: { owned: 2 },
      businesses: { total: 1 },
    } as EmpireManagementData;
    expect(empireBusinessesOwned(data)).toBe(2);
  });
});
