import { describe, it, expect } from 'vitest';
import {
  estimateSupplyOrderTotal,
  maxAffordableForOrderLine,
  mergeSupplyOrderLines,
} from './supply-order';

describe('supply order client helpers', () => {
  it('merges same item additions', () => {
    expect(
      mergeSupplyOrderLines([
        { itemId: 'beer', quantity: 500 },
        { itemId: 'beer', quantity: 1000 },
      ]),
    ).toEqual([{ itemId: 'beer', quantity: 1500 }]);
  });

  it('estimates totals from canonical prices only', () => {
    const total = estimateSupplyOrderTotal([
      { itemId: 'beer', quantity: 1000 },
      { itemId: 'condom', quantity: 500 },
    ]);
    expect(total).toBe(1000 * 4 + 500 * 2);
  });

  it('resolves MAX using cash minus other cart lines', () => {
    const lines = [{ itemId: 'beer' as const, quantity: 1000 }];
    const max = maxAffordableForOrderLine(10_000, lines, 'condom', 2);
    expect(max).toBe(Math.floor((10_000 - 4000) / 2));
  });
});
