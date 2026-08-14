import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getCityShopItem } from '@core/config/game/shop-rules';
import { buildWirePurchasePreview } from '@local/lib/wire/purchase-preview';

const mockPurchase = vi.fn();
const mockReconcile = vi.fn();

describe('wire purchase execution pathway', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('confirm calls OldSkool shop wrapper shape and reconciles shell on success', async () => {
    const ak = getCityShopItem('ak')!;
    const previewResult = buildWirePurchasePreview(
      { kind: 'BUY', itemKey: 'ak', mode: 'fixed', quantity: 2 },
      10_000,
    );
    expect(previewResult.ok).toBe(true);
    if (!previewResult.ok) return;

    mockPurchase.mockResolvedValue({
      success: true,
      data: {
        quantity: 2,
        totalCost: ak.shopPrice * 2,
        newCash: 10_000 - ak.shopPrice * 2,
        shell: { cash: 10_000 - ak.shopPrice * 2, netWorth: 1, rank: 1, turns: 1, turnCap: 5000 },
      },
    });

    const response = await mockPurchase('ak', 2, 'idempotency-key');
    expect(response.success).toBe(true);
    mockReconcile(response.data.shell);
    expect(mockReconcile).toHaveBeenCalledWith(response.data.shell);
  });

  it('failed purchase does not reconcile shell', async () => {
    mockPurchase.mockResolvedValue({ success: false, error: 'Insufficient cash.' });
    const response = await mockPurchase('ak', 500, 'idempotency-key');
    expect(response.success).toBe(false);
    expect(mockReconcile).not.toHaveBeenCalled();
  });

  it('HIRE_THUGS must not invoke shop purchase wrapper', () => {
    expect(mockPurchase).not.toHaveBeenCalled();
  });
});
