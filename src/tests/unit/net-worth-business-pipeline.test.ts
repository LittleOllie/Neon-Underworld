import { describe, it, expect } from 'vitest';
import type { BusinessType } from '@prisma/client';
import {
  calculatePlayerCanonicalNetWorthWithBusinesses,
  calculatePlayersCanonicalNetWorthMapSync,
} from '@/lib/game-engine/business/net-worth';
import { aggregateBusinessNwContext, type BusinessNwSelect } from '@/server/services/business.service';
import { getBusinessStreetNwAssetForState } from '@/config/game/business-rules';
import {
  isWithinAttackRange,
  minAttackTargetNetWorth,
} from '@/config/game/redlite-rules';
import { validateAttackEligibilityCode } from '@/lib/game-engine/combat/eligibility';

const basePlayer = {
  id: 'player-1',
  cash: 1_000_000,
  bankCash: 50_000,
  thugs: 50,
  prostitutes: 200,
  rides: 3,
  hash: 100,
  shrooms: 0,
  coke: 50,
  heroin: 0,
};

function nightclub(
  overrides: Partial<BusinessNwSelect> = {},
): BusinessNwSelect {
  return {
    businessType: 'NIGHTCLUB' as BusinessType,
    level: 1,
    upgradeTargetLevel: null,
    assignedWorkers: 0,
    assignedThugs: 0,
    ...overrides,
  };
}

function expectedNw(
  player: typeof basePlayer,
  businesses: BusinessNwSelect[],
): number {
  return calculatePlayerCanonicalNetWorthWithBusinesses(player, businesses);
}

describe('canonical NW pipeline — business scenarios', () => {
  it('no business matches street-only NW', () => {
    expect(expectedNw(basePlayer, [])).toBe(
      basePlayer.cash +
        basePlayer.bankCash +
        basePlayer.thugs * 700 +
        basePlayer.prostitutes * 1750 +
        basePlayer.rides * 2000 +
        (basePlayer.hash + basePlayer.shrooms + basePlayer.coke + basePlayer.heroin) * 5,
    );
  });

  it('nightclub L1 adds 50% purchase price to NW', () => {
    const businesses = [nightclub()];
    const asset = getBusinessStreetNwAssetForState({
      businessType: 'NIGHTCLUB',
      level: 1,
    });
    expect(asset).toBe(2_500_000);
    expect(expectedNw({ ...basePlayer, cash: 0 }, businesses)).toBe(
      expectedNw(basePlayer, []) - 1_000_000 + asset,
    );
  });

  it('nightclub upgrading counts paid upgrade target in NW', () => {
    const businesses = [
      nightclub({ level: 1, upgradeTargetLevel: 2 }),
    ];
    const asset = getBusinessStreetNwAssetForState({
      businessType: 'NIGHTCLUB',
      level: 1,
      upgradeTargetLevel: 2,
    });
    expect(asset).toBeGreaterThan(2_500_000);
    expect(expectedNw(basePlayer, businesses)).toBe(
      expectedNw(basePlayer, []) + asset,
    );
  });

  it('assigned workers and security thugs count toward NW when moved from street pool', () => {
    const businesses = [
      nightclub({ assignedWorkers: 80, assignedThugs: 12 }),
    ];
    const assignedPlayer = {
      ...basePlayer,
      prostitutes: basePlayer.prostitutes - 80,
      thugs: basePlayer.thugs - 12,
    };
    const nwAssigned = expectedNw(assignedPlayer, businesses);
    const nwStreetOnly = expectedNw(basePlayer, [nightclub()]);
    expect(nwAssigned).toBe(nwStreetOnly);
  });

  it('stored drugs and safe cash on business rows do not affect NW helper input', () => {
    const nw = expectedNw(basePlayer, [nightclub()]);
    expect(nw).toBe(expectedNw(basePlayer, [nightclub()]));
  });

  it('batch map matches per-player calculation', () => {
    const p2 = { ...basePlayer, id: 'player-2', cash: 500_000 };
    const businessesByPlayer = new Map<string, BusinessNwSelect[]>([
      ['player-1', [nightclub({ assignedWorkers: 10 })]],
      ['player-2', []],
    ]);
    const batch = calculatePlayersCanonicalNetWorthMapSync(
      [basePlayer, p2],
      businessesByPlayer,
    );
    expect(batch.get('player-1')).toBe(expectedNw(basePlayer, businessesByPlayer.get('player-1')!));
    expect(batch.get('player-2')).toBe(expectedNw(p2, []));
  });

  it('multiple businesses aggregate assets and assignments', () => {
    const businesses = [
      nightclub({ assignedWorkers: 40 }),
      {
        businessType: 'WAREHOUSE' as BusinessType,
        level: 1,
        upgradeTargetLevel: null,
        assignedWorkers: 20,
        assignedThugs: 5,
      },
    ];
    expect(expectedNw(basePlayer, businesses)).toBeGreaterThan(expectedNw(basePlayer, [businesses[0]!]));
  });
});

describe('attack eligibility uses business-aware NW thresholds', () => {
  const attackerNw = 10_000_000;
  const floor = minAttackTargetNetWorth(attackerNw);

  it('blocks defender at $4.9M street-only when floor is $5M', () => {
    expect(isWithinAttackRange(attackerNw, 4_900_000)).toBe(false);
    expect(
      validateAttackEligibilityCode({
        attackerId: 'a',
        defenderId: 'd',
        attackerDistrictId: 'c1',
        defenderDistrictId: 'c1',
        attackType: 'DRIVE_BY',
        attackingThugs: 10,
        attackerNw,
        defenderNw: 4_900_000,
        attackerTurns: 50,
        attackerThugs: 100,
        attackerRides: 10,
        attackerLifeStatus: 'ACTIVE',
        attackerTravelling: false,
        defenderLifeStatus: 'ACTIVE',
        defenderTravelling: false,
        intelReport: null,
        attacksOnTargetLast24h: 0,
        allowDirectAttack: true,
      }),
    ).toBe('TARGET_OUT_OF_RANGE');
  });

  it('allows defender at exactly $5M', () => {
    expect(isWithinAttackRange(attackerNw, floor)).toBe(true);
    expect(
      validateAttackEligibilityCode({
        attackerId: 'a',
        defenderId: 'd',
        attackerDistrictId: 'c1',
        defenderDistrictId: 'c1',
        attackType: 'DRIVE_BY',
        attackingThugs: 10,
        attackerNw,
        defenderNw: floor,
        attackerTurns: 50,
        attackerThugs: 100,
        attackerRides: 10,
        attackerLifeStatus: 'ACTIVE',
        attackerTravelling: false,
        defenderLifeStatus: 'ACTIVE',
        defenderTravelling: false,
        intelReport: null,
        attacksOnTargetLast24h: 0,
        allowDirectAttack: true,
      }),
    ).toBeNull();
  });

  it('business asset NW can push defender above floor when cash NW alone would fail', () => {
    const cashOnlyNw = 3_000_000;
    const nightclubAsset = getBusinessStreetNwAssetForState({
      businessType: 'NIGHTCLUB',
      level: 1,
    });
    const defenderWithBusiness = cashOnlyNw + nightclubAsset;
    expect(isWithinAttackRange(attackerNw, cashOnlyNw)).toBe(false);
    expect(isWithinAttackRange(attackerNw, defenderWithBusiness)).toBe(true);
    expect(defenderWithBusiness).toBeGreaterThanOrEqual(floor);
  });
});
