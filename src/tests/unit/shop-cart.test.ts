import { describe, it, expect } from 'vitest';
import {
  buildShopCartPlayerUpdate,
  calculateShopCartTotalCost,
  mergeShopCartLines,
  resolveShopCartLine,
  validateShopCartOrder,
} from '@/lib/game-engine/shop-cart';

describe('shop cart engine', () => {
  it('merges duplicate item lines', () => {
    expect(
      mergeShopCartLines([
        { itemId: 'beer', quantity: 500 },
        { itemId: 'beer', quantity: 1000 },
      ]),
    ).toEqual([{ itemId: 'beer', quantity: 1500 }]);
  });

  it('calculates authoritative totals from canonical prices', () => {
    const total = calculateShopCartTotalCost([
      { itemId: 'beer', quantity: 100 },
      { itemId: 'condom', quantity: 50 },
    ]);
    expect(total).toBe(100 * 4 + 50 * 2);
  });

  it('rejects insufficient cash for the full order', () => {
    const result = validateShopCartOrder(
      { cash: 1000, lifeStatus: 'ACTIVE', travelling: false },
      [{ itemId: 'ride', quantity: 1 }],
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain('Your order costs');
    }
  });

  it('rejects invalid quantities without partial acceptance', () => {
    const result = validateShopCartOrder(
      { cash: 1_000_000, lifeStatus: 'ACTIVE', travelling: false },
      [
        { itemId: 'beer', quantity: 100 },
        { itemId: 'thugs', quantity: 0 },
      ],
    );
    expect(result.ok).toBe(false);
  });

  it('includes thugs at canonical hire price', () => {
    const line = resolveShopCartLine('thugs', 2);
    expect(line.unitPrice).toBe(7500);
    expect(line.lineCost).toBe(15000);
  });

  it('builds one player update with all increments and a single cash decrement', () => {
    const lines = [
      resolveShopCartLine('beer', 10),
      resolveShopCartLine('glock', 2),
      resolveShopCartLine('thugs', 1),
    ];
    const total = lines.reduce((sum, line) => sum + line.lineCost, 0);
    const update = buildShopCartPlayerUpdate(lines, total);
    expect(update).toMatchObject({
      cash: { decrement: total },
      beer: { increment: 10 },
      glocks: { increment: 2 },
      thugs: { increment: 1 },
    });
  });
});
