import { describe, it, expect } from 'vitest';
import {
  CITY_SHOP_ITEMS,
  CITY_SHOP_ITEM_KEYS,
  SHOP_HASH_UNIT_PRICE,
  isCityShopItem,
  isPersonnelItem,
  PERSONNEL_CATALOG,
  shopPurchaseNetWorthDelta,
  validateCityShopPricing,
} from '@/config/game/shop-rules';
import { REDLITE_NET_WORTH } from '@/config/game/redlite-rules';
import { shopPurchaseSchema } from '@/lib/validation/schemas';
import { calculateNetWorth } from '@/lib/game-engine/net-worth';
import { playerCashFromGross } from '@/lib/game-engine/worker-economics';
import { getScoutAreaDisplays } from '@/lib/game-engine/scout-display';

describe('City Shop pricing guardrails', () => {
  it('passes shared validation: NW items priced above canonical value', () => {
    const { valid, violations } = validateCityShopPricing();
    expect(valid).toBe(true);
    expect(violations).toEqual([]);
  });

  it('reads all prices from central CITY_SHOP_ITEMS configuration', () => {
    expect(CITY_SHOP_ITEMS.find((i) => i.key === 'hash')?.shopPrice).toBe(SHOP_HASH_UNIT_PRICE);
    expect(CITY_SHOP_ITEMS.every((i) => typeof i.shopPrice === 'number' && i.shopPrice > 0)).toBe(true);
  });

  it('hash shop price exceeds $5 drug net-worth unit', () => {
    const hash = CITY_SHOP_ITEMS.find((i) => i.key === 'hash')!;
    expect(hash.shopPrice).toBe(8);
    expect(hash.shopPrice).toBeGreaterThan(REDLITE_NET_WORTH.hash);
    expect(shopPurchaseNetWorthDelta(hash, 1)).toBeLessThan(0);
  });

  it('buying hash does not increase net worth', () => {
    const hash = CITY_SHOP_ITEMS.find((i) => i.key === 'hash')!;
    const before = calculateNetWorth({
      cash: 10000,
      prostitutes: 0,
      thugs: 0,
      rides: 0,
      hash: 0,
      shrooms: 0,
      coke: 0,
      heroin: 0,
    });
    const after = calculateNetWorth({
      cash: 10000 - hash.shopPrice * 10,
      prostitutes: 0,
      thugs: 0,
      rides: 0,
      hash: 10,
      shrooms: 0,
      coke: 0,
      heroin: 0,
    });
    expect(after).toBeLessThanOrEqual(before);
  });

  it('buying rides does not increase net worth', () => {
    const ride = CITY_SHOP_ITEMS.find((i) => i.key === 'ride')!;
    const before = calculateNetWorth({
      cash: 20000,
      prostitutes: 0,
      thugs: 0,
      rides: 0,
      hash: 0,
      shrooms: 0,
      coke: 0,
      heroin: 0,
    });
    const after = calculateNetWorth({
      cash: 20000 - ride.shopPrice,
      prostitutes: 0,
      thugs: 0,
      rides: 1,
      hash: 0,
      shrooms: 0,
      coke: 0,
      heroin: 0,
    });
    expect(after).toBeLessThan(before);
    expect(shopPurchaseNetWorthDelta(ride, 1)).toBe(
      REDLITE_NET_WORTH.rides - ride.shopPrice,
    );
  });

  for (const key of ['shroom', 'coke', 'heroin'] as const) {
    it(`buying ${key} does not increase net worth`, () => {
      const item = CITY_SHOP_ITEMS.find((i) => i.key === key)!;
      expect(shopPurchaseNetWorthDelta(item, 1)).toBeLessThan(0);
      const before = calculateNetWorth({
        cash: 50000,
        prostitutes: 0,
        thugs: 0,
        rides: 0,
        hash: 0,
        shrooms: 0,
        coke: 0,
        heroin: 0,
      });
      const field = item.field;
      const afterResources = {
        cash: 50000 - item.shopPrice,
        prostitutes: 0,
        thugs: 0,
        rides: 0,
        hash: 0,
        shrooms: 0,
        coke: 0,
        heroin: 0,
        [field]: 1,
      };
      expect(calculateNetWorth(afterResources)).toBeLessThanOrEqual(before);
    });
  }
});

describe('City Shop rules', () => {
  it('does not sell workers or thugs in city shop inventory', () => {
    expect(CITY_SHOP_ITEM_KEYS).not.toContain('whore' as never);
    expect(CITY_SHOP_ITEM_KEYS).not.toContain('thug' as never);
    expect(CITY_SHOP_ITEMS.every((i) => i.cityShop)).toBe(true);
  });

  it('keeps personnel in tradable catalog for future market', () => {
    expect(PERSONNEL_CATALOG.map((p) => p.key)).toEqual(['whore', 'thug']);
    expect(PERSONNEL_CATALOG[0]?.netWorthValue).toBe(1750);
    expect(PERSONNEL_CATALOG[1]?.netWorthValue).toBe(700);
  });

  it('rejects personnel in shop purchase schema', () => {
    expect(shopPurchaseSchema.safeParse({
      item: 'whore',
      quantity: 1,
      idempotencyKey: '00000000-0000-4000-8000-000000000001',
    }).success).toBe(false);
  });

  it('flags personnel items correctly', () => {
    expect(isPersonnelItem('whore')).toBe(true);
    expect(isCityShopItem('ak')).toBe(true);
  });

  it('weapons and consumables do not contribute to net worth flag', () => {
    expect(CITY_SHOP_ITEMS.find((i) => i.key === 'beer')?.contributesToNetWorth).toBe(false);
    expect(CITY_SHOP_ITEMS.find((i) => i.key === 'condom')?.contributesToNetWorth).toBe(false);
  });
});

describe('Payout trade-off', () => {
  it('low payout retains more worker income', () => {
    expect(playerCashFromGross(10000, 10)).toBeGreaterThan(playerCashFromGross(10000, 80));
  });
});

describe('Scout area display', () => {
  it('exposes five areas with tiers not raw multipliers', () => {
    const areas = getScoutAreaDisplays();
    expect(areas).toHaveLength(5);
    expect(areas[0]?.workers).toMatch(/High|Medium|Low/);
  });
});
