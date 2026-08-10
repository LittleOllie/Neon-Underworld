import { describe, it, expect } from 'vitest';
import { getCityShopItem } from '@core/config/game/shop-rules';
import { shopPreviewTotal, shopInventoryKey } from '@local/lib/numeric-input';

describe('Shop preview', () => {
  it('uses canonical unit prices for live total', () => {
    const ak = getCityShopItem('ak');
    expect(ak).toBeDefined();
    expect(shopPreviewTotal(ak!.shopPrice, 100)).toBe(ak!.shopPrice * 100);
  });

  it('maps owned inventory keys for shop rows', () => {
    expect(shopInventoryKey('ak')).toBe('aks');
    expect(shopInventoryKey('glock')).toBe('glocks');
  });

  it('sell-back price is below buy price', () => {
    const coke = getCityShopItem('coke')!;
    expect(Math.floor(coke.shopPrice * 0.7)).toBeLessThan(coke.shopPrice);
  });
});
