'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { v4 as uuidv4 } from 'uuid';
import { ACTION_PENDING } from '@local/lib/loading-copy';
import { useGameplayReconcile } from '@local/hooks/useGameplayReconcile';
import { useMutationLock } from '@local/hooks/useMutationLock';
import {
  shopCartCheckoutAction,
  shopPurchaseAction,
  shopSellAction,
  streetDrugSaleAction,
  type ShopCatalogEntry,
  type ShopPageData,
} from '@local/server/actions/shop.actions';
import { hireThugsAction } from '@local/server/actions/hire-thugs.actions';
import { sellThugsAction } from '@local/server/actions/sell-thugs.actions';
import { THUG_HIRE_PRICE, THUG_SELL_PRICE } from '@core/config/game/hire-thugs-rules';
import { SHOP_BULK_QUANTITIES, SHOP_MAX_SINGLE_PURCHASE_QUANTITY } from '@core/config/game/shop-rules';
import type { ShopCartLineKey } from '@core/server/actions/shop.actions';
import { streetDrugFromShopKey, OLDSKOOL_SHOP_TABS, type OldSkoolShopTab } from '@local/config/shop-display';
import { buildCatalogPrices, maxAffordableForOrderLine, mergeSupplyOrderLines, estimateSupplyOrderTotal } from '@local/features/shop/supply-order';
import { useSupplyOrder } from '@local/features/shop/useSupplyOrder';
import { SupplyOrderReview } from '@local/features/shop/SupplyOrderReview';
import { NumericInput } from '@local/components/game/NumericInput';
import { PrimaryButton } from '@local/components/game/PrimaryButton';
import { ActionResult } from '@local/components/game/ActionResult';
import { GameValue } from '@local/components/game/GameValue';
import { GameIcon } from '@local/components/game/GameIcon';
import {
  parsePositiveInteger,
  shopPreviewTotal,
  shopInventoryKey,
  validateQuantity,
  maxAffordableQuantity,
} from '@local/lib/numeric-input';
import { OS_TERMS } from '@local/config/terminology';

type ShopFormProps = ShopPageData & {
  initialTab?: OldSkoolShopTab;
  highlightItem?: string | null;
};

type ShopMode = 'buy' | 'sell';

type TransactionResult = {
  mode: ShopMode | 'sell-thugs' | 'cart';
  name: string;
  qty: number;
  amount: number;
  newThugs?: number;
  itemTypeCount?: number;
};

export function ShopForm({
  catalog,
  cash: initialCash,
  inventory: initialInventory,
  streetDrugPrices,
  initialTab = 'weapons',
  highlightItem = null,
}: ShopFormProps) {
  const reconcile = useGameplayReconcile();
  const { locked, pendingKey, run } = useMutationLock();
  const order = useSupplyOrder();
  const searchParams = useSearchParams();
  const highlightRef = useRef<HTMLDivElement | null>(null);
  const catalogPrices = useMemo(
    () => buildCatalogPrices(catalog.map((entry) => ({ key: entry.key, displayName: entry.displayName, unitPrice: entry.unitPrice }))),
    [catalog],
  );
  const [cash, setCash] = useState(initialCash);
  const [inventory, setInventory] = useState(initialInventory);
  const [quantities, setQuantities] = useState<Record<string, string>>({});
  const [hireQtyRaw, setHireQtyRaw] = useState('1');
  const [sellThugsQtyRaw, setSellThugsQtyRaw] = useState('1');
  const [tab, setTab] = useState<OldSkoolShopTab>(initialTab);
  const [mode, setMode] = useState<ShopMode>('buy');
  const [error, setError] = useState('');
  const [result, setResult] = useState<TransactionResult | null>(null);

  useEffect(() => {
    if (highlightItem && highlightRef.current) {
      highlightRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }, [highlightItem, tab]);

  useEffect(() => {
    if (searchParams.get('review') === '1' && order.hasItems) {
      order.openReview();
    }
  }, [searchParams, order]);

  const items = useMemo(() => {
    const tabDef = OLDSKOOL_SHOP_TABS.find((t) => t.id === tab) ?? OLDSKOOL_SHOP_TABS[0];
    return catalog.filter((entry) => tabDef.categories.includes(entry.category));
  }, [catalog, tab]);

  function setBulkQuantity(rawKey: string, amount: number) {
    setQuantities((prev) => ({ ...prev, [rawKey]: String(amount) }));
  }

  function renderBulkButtons(
    itemId: ShopCartLineKey,
    unitPrice: number,
    onSelect: (n: number) => void,
  ) {
    const max =
      mode === 'buy' && order.hasItems
        ? maxAffordableForOrderLine(cash, order.lines, itemId, unitPrice)
        : maxAffordableQuantity(cash, unitPrice);
    const capped = Math.min(max, SHOP_MAX_SINGLE_PURCHASE_QUANTITY);
    if (capped <= 0) return null;
    return (
      <div className="g-turn-quick" role="group" aria-label="Quick quantities">
        {SHOP_BULK_QUANTITIES.filter((q) => q <= capped).map((q) => (
          <button
            key={q}
            type="button"
            className="g-turn-quick-btn"
            disabled={locked || order.reviewOpen}
            onClick={() => onSelect(q)}
          >
            {q.toLocaleString()}
          </button>
        ))}
        <button
          type="button"
          className="g-turn-quick-btn"
          disabled={locked || order.reviewOpen}
          onClick={() => onSelect(capped)}
        >
          MAX
        </button>
      </div>
    );
  }

  function ownedCount(entry: ShopCatalogEntry): number {
    const key = shopInventoryKey(entry.key);
    if (!key) return 0;
    return inventory[key];
  }

  function parsedQty(key: string): number | null {
    return parsePositiveInteger(quantities[key] ?? '1');
  }

  function unitPrice(entry: ShopCatalogEntry): number {
    if (mode === 'sell') {
      const streetDrug = streetDrugFromShopKey(entry.key);
      if (streetDrug) return streetDrugPrices[streetDrug];
    }
    return mode === 'buy' ? entry.unitPrice : entry.sellUnitPrice;
  }

  async function handleAddToOrder(itemId: ShopCartLineKey, quantity: number, displayName: string) {
    const validationError = validateQuantity(quantity);
    if (validationError) {
      setError(validationError);
      return;
    }
    const existingQty = order.lines.find((line) => line.itemId === itemId)?.quantity ?? 0;
    const nextLines = mergeSupplyOrderLines([
      ...order.lines.filter((line) => line.itemId !== itemId),
      { itemId, quantity: existingQty + quantity },
    ]);
    if (estimateSupplyOrderTotal(nextLines) > cash) {
      setError(`Not enough cash to add ${quantity.toLocaleString()} ${displayName} to your order.`);
      return;
    }
    setError('');
    order.addLine(itemId, quantity);
  }

  async function handleBuyNow(itemId: ShopCartLineKey, quantity: number, displayName: string) {
    const validationError = validateQuantity(quantity);
    if (validationError) {
      setError(validationError);
      return;
    }

    if (itemId === 'thugs') {
      await run('hire-thugs', async () => {
        setError('');
        const response = await hireThugsAction(quantity, uuidv4());
        if (!response.success) {
          setError(response.error);
          return;
        }
        setCash(response.data.newCash);
        setInventory((prev) => ({ ...prev, thugs: response.data.newThugs }));
        setResult({
          mode: 'buy',
          name: displayName,
          qty: quantity,
          amount: response.data.totalCost,
        });
        reconcile(response.data.shell);
      });
      return;
    }

    await run(itemId, async () => {
      setError('');
      const response = await shopPurchaseAction(itemId, quantity, uuidv4());
      if (!response.success) {
        setError(response.error);
        return;
      }
      setCash(response.data.newCash);
      const invKey = shopInventoryKey(itemId);
      if (invKey) {
        setInventory((prev) => ({ ...prev, [invKey]: response.data.newOwnedQuantity }));
      }
      setResult({
        mode: 'buy',
        name: displayName,
        qty: quantity,
        amount: response.data.totalCost,
      });
      reconcile(response.data.shell);
    });
  }

  async function handleCheckout() {
    if (order.lines.length === 0) return;
    await run('shop-cart-checkout', async () => {
      setError('');
      const response = await shopCartCheckoutAction(order.lines, uuidv4());
      if (!response.success) {
        setError(response.error);
        return;
      }

      setCash(response.data.newCash);
      setInventory((prev) => {
        const next = { ...prev };
        for (const line of response.data.lines) {
          const invKey = line.itemId === 'thugs' ? 'thugs' : shopInventoryKey(line.itemId);
          if (invKey) next[invKey] = line.newOwnedQuantity;
        }
        return next;
      });
      order.clearOrder();
      setResult({
        mode: 'cart',
        name: 'Supply order',
        qty: response.data.totalUnits,
        amount: response.data.totalCost,
        itemTypeCount: response.data.itemTypeCount,
      });
      reconcile(response.data.shell);
    });
  }

  async function handleSell(entry: ShopCatalogEntry) {
    const owned = ownedCount(entry);
    if (owned <= 0) {
      setError(`You have no ${entry.displayName} to sell.`);
      return;
    }
    const quantity = parsedQty(entry.key);
    const validationError = validateQuantity(quantity);
    if (validationError) {
      setError('Enter an amount to sell.');
      return;
    }
    if (quantity! > owned) {
      setError(`You don't own enough ${entry.displayName}.`);
      return;
    }
    await run(entry.key, async () => {
      setError('');
      const streetDrug = streetDrugFromShopKey(entry.key);
      const response = streetDrug
        ? await streetDrugSaleAction(streetDrug, quantity!, uuidv4())
        : await shopSellAction(entry.key, quantity!, uuidv4());
      if (!response.success) {
        setError(response.error);
        return;
      }
      setCash(response.data.newCash);
      const invKey = shopInventoryKey(entry.key);
      if (invKey) {
        setInventory((prev) => ({ ...prev, [invKey]: response.data.newOwnedQuantity }));
      }
      setResult({
        mode: 'sell',
        name: entry.displayName,
        qty: quantity!,
        amount: response.data.totalPayout,
      });
      reconcile(response.data.shell);
    });
  }

  async function handleSellThugs() {
    const quantity = parsePositiveInteger(sellThugsQtyRaw);
    const validationError = validateQuantity(quantity);
    if (validationError) {
      setError(validationError);
      return;
    }
    if (quantity! > inventory.thugs) {
      setError(`You only have ${inventory.thugs.toLocaleString()} ${OS_TERMS.enforcers.toLowerCase()} available to release.`);
      return;
    }
    await run('sell-thugs', async () => {
      setError('');
      const response = await sellThugsAction(quantity!, uuidv4());
      if (!response.success) {
        setError(response.error);
        return;
      }
      setCash(response.data.newCash);
      setInventory((prev) => ({ ...prev, thugs: response.data.newThugs }));
      setResult({
        mode: 'sell-thugs',
        name: OS_TERMS.enforcers,
        qty: quantity!,
        amount: response.data.totalPayout,
        newThugs: response.data.newThugs,
      });
      reconcile(response.data.shell);
    });
  }

  const hireQty = parsePositiveInteger(hireQtyRaw);
  const sellThugsQty = parsePositiveInteger(sellThugsQtyRaw);
  const sellThugsTotal = sellThugsQty ? shopPreviewTotal(THUG_SELL_PRICE, sellThugsQty) : null;
  const cannotSellThugs =
    sellThugsQty !== null && (sellThugsQty > inventory.thugs || inventory.thugs <= 0);
  const isCrewTab = tab === 'crew';
  const checkoutLocked = locked || order.reviewOpen;

  if (result) {
    if (result.mode === 'cart') {
      return (
        <ActionResult
          title="Purchase Complete"
          lines={[
            { text: `${result.itemTypeCount?.toLocaleString() ?? '0'} item types purchased`, tone: 'positive' },
            { text: `$${result.amount.toLocaleString()} spent`, tone: 'value' },
            { text: `$${cash.toLocaleString()} cash on hand`, tone: 'value' },
          ]}
          actions={[
            {
              label: 'Shop Again',
              primary: true,
              icon: 'shop',
              onClick: () => setResult(null),
            },
          ]}
        />
      );
    }
    if (result.mode === 'sell-thugs') {
      return (
        <ActionResult
          title={`${OS_TERMS.enforcers.toUpperCase()} RELEASED`}
          lines={[
            { text: `−${result.qty.toLocaleString()} ${OS_TERMS.enforcers}`, tone: 'negative' },
            { text: `Received: $${result.amount.toLocaleString()}`, tone: 'positive' },
            { text: `Total ${OS_TERMS.enforcers}: ${result.newThugs?.toLocaleString() ?? '—'}`, tone: 'value' },
          ]}
          actions={[
            {
              label: 'Back to Crew',
              primary: true,
              icon: 'thugs',
              onClick: () => setResult(null),
            },
          ]}
        />
      );
    }
    const isBuy = result.mode === 'buy';
    return (
      <ActionResult
        title={isBuy ? 'Purchase Complete' : 'Sold'}
        lines={[
          { text: `${result.qty}× ${result.name}`, tone: 'positive' },
          {
            text: isBuy
              ? `$${result.amount.toLocaleString()} spent`
              : `+$${result.amount.toLocaleString()} CASH`,
            tone: 'value',
          },
          { text: `$${cash.toLocaleString()} cash on hand`, tone: 'value' },
        ]}
        actions={[
          {
            label: isBuy ? 'Shop Again' : 'Sell More',
            primary: true,
            icon: 'shop',
            onClick: () => setResult(null),
          },
        ]}
      />
    );
  }

  return (
    <div aria-busy={locked || undefined} className="g-shop-shell">
      {order.reviewOpen ? (
        <SupplyOrderReview
          lines={order.lines}
          catalogPrices={catalogPrices}
          cash={cash}
          estimatedTotal={order.estimatedTotal}
          totalUnits={order.totalUnits}
          locked={locked}
          checkoutPending={pendingKey === 'shop-cart-checkout'}
          error={error}
          onClose={order.closeReview}
          onClear={() => {
            order.clearOrder();
            setError('');
          }}
          onUpdateQuantity={order.updateLineQuantity}
          onRemoveLine={order.removeLine}
          onCheckout={handleCheckout}
        />
      ) : null}

      <div className="g-gameplay-controls g-shop-chrome">
      <div className="g-shop-mode">
        <button
          type="button"
          className={`g-shop-mode-btn${mode === 'buy' ? ' g-shop-mode-btn--active' : ''}`}
          disabled={locked || order.reviewOpen}
          onClick={() => {
            setMode('buy');
            setError('');
          }}
        >
          Buy
        </button>
        <button
          type="button"
          className={`g-shop-mode-btn${mode === 'sell' ? ' g-shop-mode-btn--active' : ''}`}
          disabled={locked || order.reviewOpen}
          onClick={() => {
            setMode('sell');
            setError('');
          }}
        >
          Sell
        </button>
      </div>

      <p className="g-shop-cash">Cash: ${cash.toLocaleString()}</p>

      {mode === 'sell' && !isCrewTab && (
        <p className="g-note">Sell items back at a discounted rate (70% of buy price).</p>
      )}
      {mode === 'sell' && isCrewTab && (
        <p className="g-note">
          Release {OS_TERMS.enforcers} for cash at 70% of the hire price (${THUG_SELL_PRICE.toLocaleString()} each).
        </p>
      )}

      <div className="g-filter-row">
        {OLDSKOOL_SHOP_TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            className={`g-filter${tab === t.id ? ' g-filter-active' : ''}`}
            disabled={locked || order.reviewOpen}
            onClick={() => {
              setTab(t.id);
            }}
          >
            <span className="g-nav-link-inner">
              <GameIcon name={t.icon} size={16} />
              <span>{t.label}</span>
            </span>
          </button>
        ))}
      </div>

      {error && <p className="g-error">{error}</p>}

      {isCrewTab && mode === 'buy' ? (
        <div className="g-shop-row">
          <p className="g-section-label">HIRE {OS_TERMS.enforcers.toUpperCase()}</p>
          <p className="g-note">
            Need {OS_TERMS.enforcers.toLowerCase()} fast? Buy now for an instant hire, or add to your
            supply order and check out once with everything else.
          </p>
          <p className="g-shop-owned">
            Price: <GameValue>${THUG_HIRE_PRICE.toLocaleString()} each</GameValue>
          </p>
          <p className="g-shop-owned">
            Current {OS_TERMS.enforcers}: <GameValue>{inventory.thugs.toLocaleString()}</GameValue>
          </p>
          <div className="g-shop-controls">
            {renderBulkButtons('thugs', THUG_HIRE_PRICE, (n) => setHireQtyRaw(String(n)))}
            <NumericInput
              id="hire-thugs-qty"
              label={`Quantity of ${OS_TERMS.enforcers} to hire`}
              value={hireQtyRaw}
              onChange={(raw) => setHireQtyRaw(raw)}
              className="g-shop-qty"
              disabled={locked || order.reviewOpen}
            />
            {hireQty !== null && (
              <span className="g-shop-total">Line total: ${shopPreviewTotal(THUG_HIRE_PRICE, hireQty).toLocaleString()}</span>
            )}
            <div className="g-shop-actions">
              <PrimaryButton
                variant="secondary"
                onClick={() => {
                  if (hireQty === null) return;
                  void handleAddToOrder('thugs', hireQty, OS_TERMS.enforcers);
                }}
                disabled={checkoutLocked || hireQty === null}
              >
                Add to order
              </PrimaryButton>
              <PrimaryButton
                icon="thugs"
                onClick={() => {
                  if (hireQty === null) return;
                  void handleBuyNow('thugs', hireQty, OS_TERMS.enforcers);
                }}
                disabled={checkoutLocked || hireQty === null || shopPreviewTotal(THUG_HIRE_PRICE, hireQty) > cash}
                pending={pendingKey === 'hire-thugs'}
              >
                {pendingKey === 'hire-thugs' ? ACTION_PENDING.hireThugs : 'Buy now'}
              </PrimaryButton>
            </div>
          </div>
        </div>
      ) : isCrewTab && mode === 'sell' ? (
        <div className="g-shop-row">
          <p className="g-section-label">RELEASE {OS_TERMS.enforcers.toUpperCase()}</p>
          <p className="g-note">
            Cut loose excess {OS_TERMS.enforcers.toLowerCase()} for cash. Released{' '}
            {OS_TERMS.enforcers} leave your crew immediately.
          </p>
          <p className="g-shop-owned">
            Payout: <GameValue>${THUG_SELL_PRICE.toLocaleString()} each</GameValue>
          </p>
          <p className="g-shop-owned">
            Current {OS_TERMS.enforcers}: <GameValue>{inventory.thugs.toLocaleString()}</GameValue>
          </p>
          {inventory.thugs <= 0 ? (
            <p className="g-note">You have no {OS_TERMS.enforcers.toLowerCase()} to release.</p>
          ) : (
            <div className="g-shop-controls">
              <NumericInput
                id="sell-thugs-qty"
                label={`Quantity of ${OS_TERMS.enforcers} to release`}
                value={sellThugsQtyRaw}
                onChange={(raw) => setSellThugsQtyRaw(raw)}
                className="g-shop-qty"
                disabled={locked || order.reviewOpen}
              />
              {sellThugsTotal !== null && (
                <span className="g-shop-total">You receive: ${sellThugsTotal.toLocaleString()}</span>
              )}
              <PrimaryButton
                icon="thugs"
                onClick={handleSellThugs}
                disabled={
                  locked ||
                  cannotSellThugs ||
                  sellThugsQty === null
                }
                pending={pendingKey === 'sell-thugs'}
              >
                {pendingKey === 'sell-thugs' ? ACTION_PENDING.releaseThugs : `Release ${OS_TERMS.enforcers}`}
              </PrimaryButton>
            </div>
          )}
          {cannotSellThugs && inventory.thugs > 0 && (
            <p className="g-error">You don&apos;t own that many {OS_TERMS.enforcers.toLowerCase()}.</p>
          )}
        </div>
      ) : (
        items.map((entry) => {
        const qty = parsedQty(entry.key);
        const price = unitPrice(entry);
        const total = qty ? shopPreviewTotal(price, qty) : null;
        const owned = ownedCount(entry);
        const cannotAffordLine =
          mode === 'buy' &&
          qty !== null &&
          order.estimatedTotal +
            shopPreviewTotal(price, qty) -
            shopPreviewTotal(price, order.lines.find((line) => line.itemId === entry.key)?.quantity ?? 0) >
            cash;
        const cannotAffordBuyNow =
          mode === 'buy' && qty !== null && shopPreviewTotal(price, qty) > cash;
        const cannotSell = mode === 'sell' && owned <= 0;

        if (mode === 'sell' && cannotSell) {
          return null;
        }

        return (
          <div
            key={entry.key}
            ref={highlightItem === entry.key ? highlightRef : undefined}
            className={`g-shop-row${highlightItem === entry.key ? ' g-shop-row-highlight' : ''}`}
          >
            <div className="g-shop-head">
              <span className="g-label">{entry.displayName}</span>
              <GameValue>
                ${price.toLocaleString()} each
                {mode === 'sell' && (
                  <span className="g-shop-price-note"> (was ${entry.unitPrice.toLocaleString()})</span>
                )}
              </GameValue>
            </div>
            <p className="g-shop-owned">
              Owned: <GameValue>{owned.toLocaleString()}</GameValue>
            </p>
            {entry.purpose ? <p className="g-shop-purpose">{entry.purpose}</p> : null}
            <div className="g-shop-controls">
              {mode === 'buy' &&
                renderBulkButtons(entry.key, price, (n) => setBulkQuantity(entry.key, n))}
              <NumericInput
                id={`qty-${entry.key}`}
                label={`Quantity of ${entry.displayName}`}
                value={quantities[entry.key] ?? '1'}
                onChange={(raw) =>
                  setQuantities((prev) => ({ ...prev, [entry.key]: raw }))
                }
                className="g-shop-qty"
                disabled={locked || order.reviewOpen}
              />
              {total !== null && (
                <span className="g-shop-total">
                  {mode === 'buy' ? 'Total' : 'You receive'}: ${total.toLocaleString()}
                </span>
              )}
              {mode === 'buy' ? (
                <div className="g-shop-actions">
                  <PrimaryButton
                    variant="secondary"
                    onClick={() => {
                      if (qty === null) return;
                      void handleAddToOrder(entry.key, qty, entry.displayName);
                    }}
                    disabled={checkoutLocked || cannotAffordLine || qty === null}
                  >
                    Add to order
                  </PrimaryButton>
                  <PrimaryButton
                    icon="shop"
                    onClick={() => {
                      if (qty === null) return;
                      void handleBuyNow(entry.key, qty, entry.displayName);
                    }}
                    disabled={checkoutLocked || cannotAffordBuyNow || qty === null}
                    pending={pendingKey === entry.key}
                  >
                    {pendingKey === entry.key ? ACTION_PENDING.shopPurchase : 'Buy now'}
                  </PrimaryButton>
                </div>
              ) : (
                <PrimaryButton
                  onClick={() => handleSell(entry)}
                  disabled={
                    locked ||
                    qty === null ||
                    (qty !== null && qty > owned)
                  }
                  pending={pendingKey === entry.key}
                >
                  {pendingKey === entry.key ? ACTION_PENDING.shopSell : `Sell ${entry.displayName}`}
                </PrimaryButton>
              )}
            </div>
            {cannotAffordLine && <p className="g-error">Not enough cash to add this line to your order.</p>}
            {cannotAffordBuyNow && <p className="g-error">Not enough cash to buy now.</p>}
          </div>
        );
      })
      )}

      {!isCrewTab && mode === 'sell' && items.every((entry) => ownedCount(entry) <= 0) && (
        <p className="g-note">Nothing to sell in this category.</p>
      )}
      </div>
    </div>
  );
}
