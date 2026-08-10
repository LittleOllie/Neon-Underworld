import { describe, it, expect } from 'vitest';
import {
  CITY_SHOP_SELL_BACK_RATIO,
  getCityShopItem,
  getCityShopSellPrice,
} from '@/config/game/shop-rules';
import { calculateCanonicalNetWorthFromPlayer } from '@/lib/game-engine/canonical-net-worth';

describe('city shop sell-back pricing', () => {
  it('uses 70% of buy price as canonical sell-back rate', () => {
    expect(CITY_SHOP_SELL_BACK_RATIO).toBe(0.7);
    const coke = getCityShopItem('coke')!;
    expect(getCityShopSellPrice('coke')).toBe(Math.floor(coke.shopPrice * 0.7));
  });

  it('always prices sell-back below buy price', () => {
    for (const key of ['glock', 'hash', 'coke', 'ride', 'beer'] as const) {
      const item = getCityShopItem(key)!;
      expect(getCityShopSellPrice(key)).toBeLessThan(item.shopPrice);
    }
  });
});

describe('shop sell net worth impact', () => {
  it('uses canonical NW after selling drugs', () => {
    const before = {
      cash: 1000,
      bankCash: 0,
      thugs: 0,
      prostitutes: 0,
      rides: 0,
      hash: 0,
      shrooms: 0,
      coke: 100,
      heroin: 0,
    };
    const nwBefore = calculateCanonicalNetWorthFromPlayer(before);
    const qty = 10;
    const payout = getCityShopSellPrice('coke') * qty;
    const after = { ...before, cash: before.cash + payout, coke: before.coke - qty };
    const nwAfter = calculateCanonicalNetWorthFromPlayer(after);
    expect(nwAfter).toBe(nwBefore - qty * 5 + payout);
  });
});
