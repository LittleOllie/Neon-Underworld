import { describe, it, expect } from 'vitest';
import {
  HOME_SHOP_SELL_PRICES,
  HOME_SHOP_PRICES_PENDING_ECONOMY_APPROVAL,
  getHomeShopSellPrice,
  isHomeShopDrug,
  HOME_SHOP_DRUGS,
} from '@/config/game/shop-rules';
import { REDLITE_MARKET_STARTING_PRICES } from '@/config/game/redlite-rules';
import { calculateCanonicalNetWorthFromPlayer } from '@/lib/game-engine/canonical-net-worth';

describe('home shop sell prices', () => {
  it('defines all four canonical drugs in one config location', () => {
    expect(HOME_SHOP_DRUGS.map((d) => d.key)).toEqual(['hash', 'shrooms', 'coke', 'heroin']);
    expect(HOME_SHOP_SELL_PRICES.hash).toBe(REDLITE_MARKET_STARTING_PRICES.hash);
    expect(HOME_SHOP_SELL_PRICES.shrooms).toBe(REDLITE_MARKET_STARTING_PRICES.shroom);
    expect(HOME_SHOP_SELL_PRICES.coke).toBe(REDLITE_MARKET_STARTING_PRICES.coke);
    expect(HOME_SHOP_SELL_PRICES.heroin).toBe(REDLITE_MARKET_STARTING_PRICES.heroin);
  });

  it('flags prices as pending economy approval', () => {
    expect(HOME_SHOP_PRICES_PENDING_ECONOMY_APPROVAL).toBe(true);
  });

  it('rejects invalid drug keys', () => {
    expect(isHomeShopDrug('beer')).toBe(false);
    expect(getHomeShopSellPrice('coke')).toBe(9);
  });
});

describe('home shop net worth impact', () => {
  it('uses canonical NW after drug sale (cash up, drugs down)', () => {
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
    const payout = getHomeShopSellPrice('coke') * qty;
    const after = { ...before, cash: before.cash + payout, coke: before.coke - qty };
    const nwAfter = calculateCanonicalNetWorthFromPlayer(after);

    expect(payout).toBe(90);
    expect(nwAfter).toBe(nwBefore - qty * 5 + payout);
  });
});
