import { describe, it, expect } from 'vitest';
import {
  empireBusinessesOwned,
  empireDrugsHeaderBadge,
  empireGearHeaderBadge,
  empireStreetDrugUnits,
  empireThugsHeaderBadge,
  empireWorkersHeaderBadge,
  empireWorkersPreviewLines,
  formatEmpireSummaryMoney,
} from './empire-helpers';
import type { EmpireManagementData } from '@local/domain/empire.model';
import { OS_TERMS } from '@local/config/terminology';

const baseWeapons: EmpireManagementData['weapons'] = {
  totalWeapons: 190,
  usableWeapons: 190,
  surplusWeapons: 0,
  shortage: 0,
  byType: [
    { key: 'glocks', name: OS_TERMS.glocks, quantity: 112, combatValue: 1 },
    { key: 'uzis', name: OS_TERMS.uzis, quantity: 50, combatValue: 1 },
    { key: 'aks', name: OS_TERMS.aks, quantity: 28, combatValue: 1 },
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
        { key: 'hash', name: OS_TERMS.hash, quantity: 4000, valuationEach: 1 },
        { key: 'shrooms', name: OS_TERMS.shrooms, quantity: 457, valuationEach: 1 },
        { key: 'coke', name: OS_TERMS.coke, quantity: 0, valuationEach: 1 },
        { key: 'heroin', name: OS_TERMS.heroin, quantity: 0, valuationEach: 1 },
      ],
    };
    expect(empireStreetDrugUnits(drugs)).toBe(4457);
    expect(empireDrugsHeaderBadge(4457)).toBe('4,457 TECH UNITS');
  });

  it('aggregates weapon count for gear header', () => {
    expect(empireGearHeaderBadge(baseWeapons, baseVehicles)).toBe('190 WEAPONS · 78 RIDES');
  });

  it('formats worker and thug header badges', () => {
    expect(empireWorkersHeaderBadge(1465)).toContain('1,465');
    expect(empireThugsHeaderBadge(865)).toContain('865');
  });

  it('builds worker preview lines from personnel split', () => {
    const data = {
      personnel: {
        streetWorkers: 1200,
        businessWorkers: 265,
      },
      statusMeters: {
        worker: { stability: { value: 72 } },
      },
    } as EmpireManagementData;
    expect(empireWorkersPreviewLines(data)).toEqual([
      '1,200 Active · 265 Business',
      'Morale 72%',
    ]);
  });

  it('reads businesses owned from operations summary', () => {
    const data = {
      businessOperations: { owned: 2 },
      businesses: { total: 1 },
    } as EmpireManagementData;
    expect(empireBusinessesOwned(data)).toBe(2);
  });
});
