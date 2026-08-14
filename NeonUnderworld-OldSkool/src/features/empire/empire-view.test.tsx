import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { EmpireSimpleView } from './EmpireSimpleView';
import type { EmpireManagementData } from '@local/domain/empire.model';
import { buildEmpireStatusMeters } from '@local/server/domain/status-presentation';

vi.mock('next/link', () => ({
  default: ({ href, children, className }: { href: string; children: React.ReactNode; className?: string }) => (
    <a href={href} className={className}>
      {children}
    </a>
  ),
}));

vi.mock('@local/features/empire/PayoutForm', () => ({
  PayoutForm: ({ initialPayout }: { initialPayout: number }) => (
    <div data-testid="payout-form">PayoutForm {initialPayout}%</div>
  ),
}));

const inventory = {
  thugs: 865,
  prostitutes: 1465,
  glocks: 112,
  uzis: 50,
  aks: 28,
  rides: 78,
  hash: 4000,
  shrooms: 457,
  coke: 0,
  heroin: 0,
  businesses: 2,
  condoms: 8,
  beer: 6,
  prostitutePayoutPercent: 21,
};

function buildMockData(): EmpireManagementData {
  return {
    player: {
      id: 'p1',
      alias: 'TestOp',
      city: 'Old Quarter',
      cartelId: null,
      cash: 3_200_000,
      bankCash: 0,
      netWorth: 18_400_000,
      turns: 400,
      turnCap: 5000,
      health: 100,
      protectionStatus: 'NONE',
      lifeStatus: 'ACTIVE',
      travelling: false,
      travelDestination: null,
      rank: 7,
    },
    personnel: {
      thugs: 865,
      workers: 1465,
      streetWorkers: 1200,
      streetThugs: 800,
      businessWorkers: 265,
      businessSecurity: 65,
      totalWorkers: 1465,
      totalThugs: 865,
      workerPayoutPercent: 21,
      estimatedWorkerMorale: 72,
      armedThugs: 750,
      unarmedThugs: 50,
    },
    weapons: {
      totalWeapons: 190,
      usableWeapons: 190,
      surplusWeapons: 0,
      shortage: 0,
      byType: [
        { key: 'glocks', name: 'Glocks', quantity: 112, combatValue: 1 },
        { key: 'uzis', name: 'Uzis', quantity: 50, combatValue: 1 },
        { key: 'aks', name: 'AKs', quantity: 28, combatValue: 1 },
      ],
    },
    vehicles: {
      totalVehicles: 78,
      totalCapacity: 780,
      occupiedCapacity: 0,
      availableCapacity: 780,
      byType: [{ key: 'rides', name: 'Rides', quantity: 78, capacityEach: 10, totalCapacity: 780 }],
    },
    drugs: {
      totalUnits: 4457,
      estimatedValue: 0,
      byType: [
        { key: 'hash', name: 'Hash', quantity: 4000, valuationEach: 1 },
        { key: 'shrooms', name: 'Shrooms', quantity: 457, valuationEach: 1 },
        { key: 'coke', name: 'Coke', quantity: 0, valuationEach: 1 },
        { key: 'heroin', name: 'Heroin', quantity: 0, valuationEach: 1 },
      ],
    },
    businesses: {
      total: 2,
      estimatedValue: 3500,
      incomeActive: true,
      byType: [],
    },
    businessOperations: {
      owned: 2,
      maxOwned: 8,
      assignedWorkers: 265,
      assignedSecurityThugs: 65,
      safeBalance: 120_000,
      totalStoredDrugs: 500,
      overallHeat: 'MODERATE',
      overallHeatScore: 45,
      sites: [],
    },
    finances: {
      cash: 3_200_000,
      bankCash: 0,
      liquidTotal: 3_200_000,
      netWorth: 18_400_000,
      estimatedIncomePerCycle: null,
      estimatedExpensesPerCycle: null,
    },
    readiness: {
      productionReady: true,
      attackReady: true,
      travelReady: true,
      marketReady: true,
      warningCount: 0,
      reasons: [],
      details: {
        production: { ready: true, label: 'Production', status: 'Ready', notes: [] },
        attack: { ready: true, label: 'Attack', status: 'Ready', notes: [] },
        travel: { ready: true, label: 'Travel', status: 'Ready', notes: [] },
        market: { ready: true, label: 'Market', status: 'Ready', notes: [] },
      },
    },
    supplySummary: {
      workers: { status: 'Stable', hash: 'Adequate', condoms: 'Low', protection: 'Adequate', payout: '21%' },
      thugs: { status: 'Stable', weapons: 'Adequate', beer: 'Adequate', armed: '750 / 800' },
    },
    statusMeters: buildEmpireStatusMeters(inventory),
    recentActivity: [],
  };
}

describe('EmpireSimpleView accordion layout', () => {
  it('renders collapsed sections closed by default with informative headers', () => {
    const html = renderToStaticMarkup(<EmpireSimpleView data={buildMockData()} />);

    expect(html).toContain('g-empire-summary');
    expect(html).toContain('District Rank');
    expect(html).toContain('#7');

    const sections = html.match(/<details class="g-business-section g-empire-section">/g);
    expect(sections?.length).toBe(5);

    expect(html).not.toMatch(/<details[^>]*open=/);
    expect(html).toContain('1,465 TOTAL');
    expect(html).toContain('865 TOTAL');
    expect(html).toContain('4,457 STREET UNITS');
    expect(html).toContain('190 WEAPONS · 78 RIDES');
    expect(html).toContain('2 OWNED');
  });

  it('places payout inside Workers and removes standalone payout section', () => {
    const html = renderToStaticMarkup(<EmpireSimpleView data={buildMockData()} />);

    expect(html).toContain('PayoutForm 21%');
    expect(html).toContain('Higher payout improves Street Worker happiness');
    expect(html).not.toMatch(/<\/details>[\s\S]*<div class="g-section-label">PAYOUT<\/div>/);
  });
});

describe('EmpireSection markup', () => {
  it('does not set open attribute by default', () => {
    const html = renderToStaticMarkup(<EmpireSimpleView data={buildMockData()} />);
    expect(html).not.toContain('open=""');
    expect(html).not.toContain(' open>');
  });
});
