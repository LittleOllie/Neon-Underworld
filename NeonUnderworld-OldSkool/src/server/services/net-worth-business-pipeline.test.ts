import { describe, it, expect } from 'vitest';
import type { BusinessType } from '@prisma/client';
import { NetWorthService } from '@local/server/services/net-worth.service';
import {
  calculatePlayerCanonicalNetWorthWithBusinesses,
} from '@core/lib/game-engine/business/net-worth';
import { getBusinessStreetNwAssetForState } from '@core/config/game/business-rules';

const player = {
  id: 'p1',
  cash: 2_000_000,
  bankCash: 100_000,
  thugs: 40,
  prostitutes: 120,
  rides: 2,
  glocks: 1,
  uzis: 0,
  aks: 0,
  hash: 200,
  shrooms: 0,
  coke: 100,
  heroin: 0,
  businesses: 1,
};

const nightclubBusiness = {
  businessType: 'NIGHTCLUB' as BusinessType,
  level: 1,
  upgradeTargetLevel: 2,
  assignedWorkers: 30,
  assignedThugs: 6,
};

function authoritativeNw(businesses: typeof nightclubBusiness[]) {
  return calculatePlayerCanonicalNetWorthWithBusinesses(player, businesses);
}

describe('NetWorthService — business-aware pipeline (sync paths)', () => {
  it('calculateWithBusinessRows matches core canonical helper', () => {
    const expected = authoritativeNw([nightclubBusiness]);
    expect(NetWorthService.calculateWithBusinessRows(player, [nightclubBusiness])).toBe(expected);
  });

  it('calculateFromPlayer with explicit context matches core helper', () => {
    const ctx = NetWorthService.aggregateBusinessNwContext([nightclubBusiness]);
    expect(
      NetWorthService.calculateFromPlayer(player, ctx),
    ).toBe(authoritativeNw([nightclubBusiness]));
  });

  it('paid upgrade asset is included while functional level remains lower', () => {
    const asset = getBusinessStreetNwAssetForState({
      businessType: 'NIGHTCLUB',
      level: 1,
      upgradeTargetLevel: 2,
    });
    const nw = authoritativeNw([nightclubBusiness]);
    const withoutUpgrade = authoritativeNw([
      { ...nightclubBusiness, upgradeTargetLevel: null },
    ]);
    expect(nw - withoutUpgrade).toBe(
      asset -
        getBusinessStreetNwAssetForState({
          businessType: 'NIGHTCLUB',
          level: 1,
        }),
    );
  });
});
