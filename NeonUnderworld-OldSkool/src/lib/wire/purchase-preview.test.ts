import { describe, it, expect } from 'vitest';
import { getCityShopItem } from '@core/config/game/shop-rules';
import { maxAffordableQuantity } from '@local/lib/numeric-input';
import { buildWirePurchasePreview } from './purchase-preview';

describe('buildWirePurchasePreview', () => {
  const akPrice = getCityShopItem('ak')!.shopPrice;

  it('builds fixed AK purchase preview using canonical price', () => {
    const result = buildWirePurchasePreview(
      { kind: 'BUY', itemKey: 'ak', mode: 'fixed', quantity: 500 },
      2_000_000,
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.preview.displayName).toBe('AK-47');
      expect(result.preview.unitPrice).toBe(akPrice);
      expect(result.preview.totalCost).toBe(akPrice * 500);
      expect(result.preview.remainingCash).toBe(2_000_000 - akPrice * 500);
    }
  });

  it('builds MAX AK preview from live cash', () => {
    const cash = 1_000_000;
    const result = buildWirePurchasePreview({ kind: 'BUY', itemKey: 'ak', mode: 'max' }, cash);
    expect(result.ok).toBe(true);
    if (result.ok) {
      const expectedQty = maxAffordableQuantity(cash, akPrice);
      expect(result.preview.quantity).toBe(expectedQty);
      expect(result.preview.totalCost).toBe(akPrice * expectedQty);
      expect(result.preview.remainingCash).toBe(cash - akPrice * expectedQty);
    }
  });

  it('reports insufficient cash for fixed quantity', () => {
    const result = buildWirePurchasePreview(
      { kind: 'BUY', itemKey: 'ak', mode: 'fixed', quantity: 500 },
      100_000,
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe('insufficient');
      expect(result.maxAffordable).toBe(maxAffordableQuantity(100_000, akPrice));
    }
  });

  it('reports zero max when cash cannot afford one unit', () => {
    const result = buildWirePurchasePreview({ kind: 'BUY', itemKey: 'ak', mode: 'max' }, akPrice - 1);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe('zero_max');
    }
  });

  it('uses canonical beer price without hard-coding', () => {
    const beerPrice = getCityShopItem('beer')!.shopPrice;
    const result = buildWirePurchasePreview(
      { kind: 'BUY', itemKey: 'beer', mode: 'fixed', quantity: 10_000 },
      beerPrice * 10_000,
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.preview.unitPrice).toBe(beerPrice);
      expect(result.preview.remainingCash).toBe(0);
    }
  });
});
