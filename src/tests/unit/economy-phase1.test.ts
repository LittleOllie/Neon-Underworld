import { describe, it, expect } from 'vitest';
import {
  planSupplyConsumption,
  applySupplyConsumption,
  supplyUnitsForCrewTurns,
} from '@/config/game/supply-economy';
import { resolveSupplyConsumptionForAction } from '@/lib/game-engine/supply-consumption';
import { payoutMoraleScore } from '@/lib/game-engine/payout-morale';
import { validateStreetDrugSale } from '@/lib/game-engine/drug-street-sale';
import { getDrugStreetPrice, validateStreetDrugPricing } from '@/config/game/drug-street-prices';
import { getCityShopItem } from '@/config/game/shop-rules';
import { resolveWeaponAttrition } from '@/lib/game-engine/combat/weapon-attrition';
import { allocateWeaponsForThugs } from '@/lib/game-engine/combat/weapon-allocation';

describe('supply consumption', () => {
  it('scales with crew and turns', () => {
    const small = planSupplyConsumption(100, 100, 100, { condoms: 1000, hash: 1000, beer: 1000 });
    const large = planSupplyConsumption(500, 500, 100, { condoms: 1000, hash: 1000, beer: 1000 });
    expect((large.required.condoms ?? 0) > (small.required.condoms ?? 0)).toBe(true);
  });

  it('never drives inventory negative', () => {
    const result = resolveSupplyConsumptionForAction({
      prostitutes: 500,
      thugs: 500,
      turnsSpent: 1000,
      condoms: 10,
      hash: 5,
      beer: 3,
    });
    expect(result.inventoryAfter.condoms).toBe(0);
    expect(result.inventoryAfter.hash).toBe(0);
    expect(result.inventoryAfter.beer).toBe(0);
  });

  it('consumes less on smaller actions', () => {
    const a = supplyUnitsForCrewTurns(100 * 50);
    const b = supplyUnitsForCrewTurns(100 * 500);
    expect(b).toBeGreaterThan(a);
  });
});

describe('payout morale', () => {
  it('low payout hurts morale slot more than generous payout', () => {
    expect(payoutMoraleScore(1)).toBeLessThan(payoutMoraleScore(50));
    expect(payoutMoraleScore(75)).toBeGreaterThanOrEqual(payoutMoraleScore(50));
  });
});

describe('street drug sales', () => {
  it('validates ownership and city price', () => {
    const ok = validateStreetDrugSale({
      districtSlug: 'neon-strip',
      drug: 'coke',
      quantity: 10,
      owned: 100,
    });
    expect(ok.valid).toBe(true);
    if (ok.valid) {
      expect(ok.unitPrice).toBe(getDrugStreetPrice('neon-strip', 'coke'));
      expect(ok.totalPayout).toBe(ok.unitPrice * 10);
    }
  });

  it('prevents shop buy → same-city street arbitrage', () => {
    expect(validateStreetDrugPricing().valid).toBe(true);
    for (const district of ['neon-strip', 'docklands', 'old-quarter'] as const) {
      for (const drug of ['hash', 'shrooms', 'coke', 'heroin'] as const) {
        const shopKey = drug === 'shrooms' ? 'shroom' : drug;
        const shop = getCityShopItem(shopKey)!;
        expect(getDrugStreetPrice(district, drug)).toBeLessThan(shop.shopPrice);
      }
    }
  });
});

describe('weapon attrition', () => {
  it('does not lose weapons without casualties', () => {
    const alloc = allocateWeaponsForThugs(10, { glocks: 5, uzis: 3, aks: 2 });
    const loss = resolveWeaponAttrition(0, alloc, { next: () => 0.5 });
    expect(loss.glocks + loss.uzis + loss.aks).toBe(0);
  });

  it('loses some committed weapons on heavy casualties', () => {
    const alloc = allocateWeaponsForThugs(100, { glocks: 0, uzis: 0, aks: 100 });
    const loss = resolveWeaponAttrition(100, alloc, { next: () => 0.5 });
    const total = loss.glocks + loss.uzis + loss.aks;
    expect(total).toBeGreaterThan(0);
    expect(total).toBeLessThanOrEqual(100);
  });
});
