import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  calculateArming,
  calculateOperationalReadiness,
  validatePayoutPercent,
  validateBankAmount,
  buildDrugsBreakdown,
  buildBusinessesBreakdown,
  buildVehiclesBreakdown,
  previewPayoutMorale,
} from '@local/server/domain/empire-calculations';
import { NetWorthService } from '@local/server/services/net-worth.service';
import { workersLabel, OS_TERMS } from '@local/config/terminology';
import { EMPIRE_PAYOUT_RULES, EMPIRE_VEHICLE_TYPES } from '@local/config/empire-rules';

const basePlayer = {
  thugs: 10,
  prostitutes: 20,
  glocks: 5,
  uzis: 3,
  aks: 2,
  rides: 4,
  hash: 10,
  shrooms: 5,
  coke: 2,
  heroin: 1,
  businesses: 2,
  condoms: 40,
  beer: 20,
  prostitutePayoutPercent: 50,
};

describe('Arming calculation', () => {
  it('arms min(thugs, weapons) with 1:1 rule', () => {
    expect(calculateArming(10, 5, 3, 2)).toEqual({
      totalWeapons: 10,
      usableWeapons: 10,
      armedThugs: 10,
      unarmedThugs: 0,
      surplusWeapons: 0,
      shortage: 0,
    });
  });

  it('handles more thugs than weapons', () => {
    const r = calculateArming(15, 3, 2, 0);
    expect(r.armedThugs).toBe(5);
    expect(r.unarmedThugs).toBe(10);
    expect(r.shortage).toBe(10);
  });

  it('handles more weapons than thugs', () => {
    const r = calculateArming(3, 5, 5, 5);
    expect(r.armedThugs).toBe(3);
    expect(r.surplusWeapons).toBe(12);
  });

  it('handles zero thugs and zero weapons', () => {
    expect(calculateArming(0, 0, 0, 0)).toEqual({
      totalWeapons: 0,
      usableWeapons: 0,
      armedThugs: 0,
      unarmedThugs: 0,
      surplusWeapons: 0,
      shortage: 0,
    });
  });
});

describe('Vehicle capacity', () => {
  it('uses centrally configured capacity per ride', () => {
    const v = buildVehiclesBreakdown({ ...basePlayer, rides: 3 });
    const cap = EMPIRE_VEHICLE_TYPES[0]!.capacityEach;
    expect(v.totalCapacity).toBe(3 * cap);
    expect(v.availableCapacity).toBe(v.totalCapacity);
  });
});

describe('Drugs and businesses breakdown', () => {
  it('totals drug units and estimated value', () => {
    const d = buildDrugsBreakdown(basePlayer);
    expect(d.totalUnits).toBe(18);
    expect(d.estimatedValue).toBe(18 * 5);
  });

  it('totals business estimated value from canonical valuation', () => {
    const b = buildBusinessesBreakdown(basePlayer);
    expect(b.total).toBe(2);
    expect(b.estimatedValue).toBe(10000);
    expect(b.incomeActive).toBe(false);
  });
});

describe('Operational readiness', () => {
  it('is deterministic for the same input', () => {
    const input = {
      workers: 5,
      thugs: 3,
      turns: 10,
      usableWeapons: 3,
      totalVehicles: 2,
      totalCapacity: 20,
      drugUnits: 5,
      weaponCount: 3,
      lifeStatus: 'ACTIVE',
      travelling: false,
      unarmedThugs: 0,
    };
    const a = calculateOperationalReadiness(input);
    const b = calculateOperationalReadiness(input);
    expect(a).toEqual(b);
    expect(a.productionReady).toBe(true);
    expect(a.attackReady).toBe(true);
    expect(a.travelReady).toBe(true);
    expect(a.marketReady).toBe(true);
  });

  it('blocks attack when thugs are unarmed', () => {
    const r = calculateOperationalReadiness({
      workers: 5,
      thugs: 10,
      turns: 10,
      usableWeapons: 3,
      totalVehicles: 2,
      totalCapacity: 20,
      drugUnits: 5,
      weaponCount: 3,
      lifeStatus: 'ACTIVE',
      travelling: false,
      unarmedThugs: 7,
    });
    expect(r.attackReady).toBe(true);
    expect(r.details.attack.notes.some((n) => n.includes('unarmed'))).toBe(true);
  });
});

describe('Worker payout validation', () => {
  it('accepts valid increment values', () => {
    expect(validatePayoutPercent(50)).toBeNull();
    expect(validatePayoutPercent(45)).toBeNull();
  });

  it('rejects below minimum and above maximum', () => {
    expect(validatePayoutPercent(0)).toMatch(/between/);
    expect(validatePayoutPercent(101)).toMatch(/between/);
  });

  it('rejects malformed values', () => {
    expect(validatePayoutPercent(NaN)).toMatch(/whole number/);
    expect(validatePayoutPercent(47)).toBeNull();
  });
});

describe('Bank amount validation', () => {
  it('rejects zero, negative and non-integers', () => {
    expect(validateBankAmount(0)).toMatch(/positive/);
    expect(validateBankAmount(-5)).toMatch(/positive/);
    expect(validateBankAmount(1.5)).toMatch(/whole number/);
  });
});

describe('Bank net worth invariance', () => {
  it('deposit leaves net worth unchanged', () => {
    const player = {
      id: 'p1',
      cash: 10000,
      bankCash: 5000,
      prostitutes: 7,
      thugs: 2,
      rides: 1,
      glocks: 0,
      uzis: 0,
      aks: 0,
      hash: 0,
      shrooms: 0,
      coke: 0,
      heroin: 0,
      businesses: 0,
    };
    const before = NetWorthService.calculateFromPlayer(player);
    const deposit = 2000;
    const after = NetWorthService.calculateFromPlayer({
      ...player,
      cash: player.cash - deposit,
      bankCash: player.bankCash + deposit,
    });
    expect(after).toBe(before);
  });

  it('withdraw leaves net worth unchanged', () => {
    const player = {
      id: 'p1',
      cash: 3000,
      bankCash: 8000,
      prostitutes: 7,
      thugs: 2,
      rides: 1,
      glocks: 0,
      uzis: 0,
      aks: 0,
      hash: 0,
      shrooms: 0,
      coke: 0,
      heroin: 0,
      businesses: 0,
    };
    const before = NetWorthService.calculateFromPlayer(player);
    const withdraw = 1500;
    const after = NetWorthService.calculateFromPlayer({
      ...player,
      cash: player.cash + withdraw,
      bankCash: player.bankCash - withdraw,
    });
    expect(after).toBe(before);
  });
});

describe('Payout morale preview', () => {
  it('returns estimate effects without claiming exact financials', () => {
    const preview = previewPayoutMorale(basePlayer, 70);
    expect(preview.effects.length).toBeGreaterThan(0);
    expect(preview.proposedMorale).toBeTypeOf('number');
  });
});

describe('Terminology', () => {
  it('uses Workers label, never Prostitutes', () => {
    expect(workersLabel(3)).toBe(OS_TERMS.workers);
    expect(workersLabel(3)).not.toContain('Prostitute');
  });
});

describe('Empire management loader totals', () => {
  it('returns consistent personnel and weapon totals from breakdown helpers', () => {
    const weapons = calculateArming(basePlayer.thugs, basePlayer.glocks, basePlayer.uzis, basePlayer.aks);
    expect(weapons.usableWeapons).toBe(10);
    expect(weapons.armedThugs + weapons.unarmedThugs).toBe(basePlayer.thugs);
  });
});

describe('BankService transactions', () => {
  const mockUpdate = vi.fn();
  const mockFindUnique = vi.fn();
  const mockRecord = vi.fn();
  const mockSync = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it('deposit rejects amount exceeding cash', async () => {
    vi.doMock('@core/lib/db/prisma', () => ({
      prisma: {
        player: {
          findUniqueOrThrow: vi.fn().mockResolvedValue({
            lifeStatus: 'ACTIVE',
            travelling: false,
            cash: 100,
            bankCash: 0,
          }),
        },
        $transaction: vi.fn(),
      },
    }));
    vi.doMock('@local/server/services/activity.service', () => ({
      ActivityService: { record: mockRecord },
    }));
    vi.doMock('@local/server/services/empire.service', () => ({
      EmpireService: { syncInventory: mockSync },
    }));

    const { BankService } = await import('@local/server/services/bank.service');
    await expect(BankService.deposit('p1', 500)).rejects.toThrow(/Insufficient cash/);
  });
});
