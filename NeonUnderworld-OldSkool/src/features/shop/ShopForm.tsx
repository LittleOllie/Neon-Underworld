'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { ACTION_PENDING } from '@local/lib/loading-copy';
import { useGameplayReconcile } from '@local/hooks/useGameplayReconcile';
import {
  shopPurchaseAction,
  shopSellAction,
  streetDrugSaleAction,
  type ShopCatalogEntry,
  type ShopPageData,
} from '@local/server/actions/shop.actions';
import { hireThugsAction } from '@local/server/actions/hire-thugs.actions';
import { sellThugsAction } from '@local/server/actions/sell-thugs.actions';
import { THUG_HIRE_PRICE, THUG_SELL_PRICE } from '@core/config/game/hire-thugs-rules';
import { streetDrugFromShopKey, OLDSKOOL_SHOP_TABS, type OldSkoolShopTab } from '@local/config/shop-display';
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
} from '@local/lib/numeric-input';

type ShopFormProps = ShopPageData & {
  initialTab?: OldSkoolShopTab;
  highlightItem?: string | null;
};

type ShopMode = 'buy' | 'sell';

type TransactionResult = {
  mode: ShopMode | 'hire' | 'sell-thugs';
  name: string;
  qty: number;
  amount: number;
  newThugs?: number;
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
  const highlightRef = useRef<HTMLDivElement | null>(null);
  const [cash, setCash] = useState(initialCash);
  const [inventory, setInventory] = useState(initialInventory);
  const [quantities, setQuantities] = useState<Record<string, string>>({});
  const [hireQtyRaw, setHireQtyRaw] = useState('1');
  const [sellThugsQtyRaw, setSellThugsQtyRaw] = useState('1');
  const [tab, setTab] = useState<OldSkoolShopTab>(initialTab);
  const [mode, setMode] = useState<ShopMode>('buy');
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [result, setResult] = useState<TransactionResult | null>(null);

  useEffect(() => {
    if (highlightItem && highlightRef.current) {
      highlightRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }, [highlightItem, tab]);

  const items = useMemo(() => {
    const tabDef = OLDSKOOL_SHOP_TABS.find((t) => t.id === tab) ?? OLDSKOOL_SHOP_TABS[0];
    return catalog.filter((entry) => tabDef.categories.includes(entry.category));
  }, [catalog, tab]);

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

  async function handleBuy(entry: ShopCatalogEntry) {
    const quantity = parsedQty(entry.key);
    const validationError = validateQuantity(quantity);
    if (validationError) {
      setError(validationError);
      return;
    }
    setLoading(entry.key);
    setError('');
    const response = await shopPurchaseAction(entry.key, quantity!, uuidv4());
    setLoading(null);
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
      mode: 'buy',
      name: entry.displayName,
      qty: quantity!,
      amount: response.data.totalCost,
    });
    reconcile(response.data.shell);
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
    setLoading(entry.key);
    setError('');
    const streetDrug = streetDrugFromShopKey(entry.key);
    const response = streetDrug
      ? await streetDrugSaleAction(streetDrug, quantity!, uuidv4())
      : await shopSellAction(entry.key, quantity!, uuidv4());
    setLoading(null);
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
  }

  async function handleHireThugs() {
    const quantity = parsePositiveInteger(hireQtyRaw);
    const validationError = validateQuantity(quantity);
    if (validationError) {
      setError(validationError);
      return;
    }
    const total = shopPreviewTotal(THUG_HIRE_PRICE, quantity!);
    if (total > cash) {
      setError(`You need $${total.toLocaleString()} to hire ${quantity!.toLocaleString()} Thugs.`);
      return;
    }
    setLoading('hire-thugs');
    setError('');
    try {
      const response = await hireThugsAction(quantity!, uuidv4());
      if (!response.success) {
        setError(response.error);
        return;
      }
      setCash(response.data.newCash);
      setInventory((prev) => ({ ...prev, thugs: response.data.newThugs }));
      setResult({
        mode: 'hire',
        name: 'Thugs',
        qty: quantity!,
        amount: response.data.totalCost,
        newThugs: response.data.newThugs,
      });
      reconcile(response.data.shell);
    } catch {
      setError('Could not complete hire. Please try again.');
    } finally {
      setLoading(null);
    }
  }

  async function handleSellThugs() {
    const quantity = parsePositiveInteger(sellThugsQtyRaw);
    const validationError = validateQuantity(quantity);
    if (validationError) {
      setError(validationError);
      return;
    }
    if (quantity! > inventory.thugs) {
      setError(`You only have ${inventory.thugs.toLocaleString()} Thugs available to release.`);
      return;
    }
    setLoading('sell-thugs');
    setError('');
    try {
      const response = await sellThugsAction(quantity!, uuidv4());
      if (!response.success) {
        setError(response.error);
        return;
      }
      setCash(response.data.newCash);
      setInventory((prev) => ({ ...prev, thugs: response.data.newThugs }));
      setResult({
        mode: 'sell-thugs',
        name: 'Thugs',
        qty: quantity!,
        amount: response.data.totalPayout,
        newThugs: response.data.newThugs,
      });
      reconcile(response.data.shell);
    } catch {
      setError('Could not complete release. Please try again.');
    } finally {
      setLoading(null);
    }
  }

  const hireQty = parsePositiveInteger(hireQtyRaw);
  const hireTotal = hireQty ? shopPreviewTotal(THUG_HIRE_PRICE, hireQty) : null;
  const cannotAffordHire = hireTotal !== null && hireTotal > cash;
  const sellThugsQty = parsePositiveInteger(sellThugsQtyRaw);
  const sellThugsTotal = sellThugsQty ? shopPreviewTotal(THUG_SELL_PRICE, sellThugsQty) : null;
  const cannotSellThugs =
    sellThugsQty !== null && (sellThugsQty > inventory.thugs || inventory.thugs <= 0);
  const isCrewTab = tab === 'crew';

  if (result) {
    if (result.mode === 'hire') {
      return (
        <ActionResult
          title="THUGS HIRED"
          lines={[
            { text: `+${result.qty.toLocaleString()} Thugs`, tone: 'positive' },
            { text: `Cost: $${result.amount.toLocaleString()}`, tone: 'value' },
            { text: `Total Thugs: ${result.newThugs?.toLocaleString() ?? '—'}`, tone: 'value' },
            { text: 'Your new Thugs may need more weapons and Beer.', tone: 'neutral' },
          ]}
          actions={[
            {
              label: 'Hire More',
              primary: true,
              icon: 'thugs',
              onClick: () => setResult(null),
            },
            { label: 'Buy Weapons', href: '/shop?tab=weapons' },
            { label: 'Buy Beer', href: '/shop?tab=supplies&item=beer' },
          ]}
        />
      );
    }
    if (result.mode === 'sell-thugs') {
      return (
        <ActionResult
          title="THUGS RELEASED"
          lines={[
            { text: `−${result.qty.toLocaleString()} Thugs`, tone: 'negative' },
            { text: `Received: $${result.amount.toLocaleString()}`, tone: 'positive' },
            { text: `Total Thugs: ${result.newThugs?.toLocaleString() ?? '—'}`, tone: 'value' },
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
    <>
      <div className="g-shop-mode">
        <button
          type="button"
          className={`g-shop-mode-btn${mode === 'buy' ? ' g-shop-mode-btn--active' : ''}`}
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
          Release Thugs for cash at 70% of the hire price (${THUG_SELL_PRICE.toLocaleString()} each).
        </p>
      )}

      <div className="g-filter-row">
        {OLDSKOOL_SHOP_TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            className={`g-filter${tab === t.id ? ' g-filter-active' : ''}`}
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
          <p className="g-section-label">HIRE THUGS</p>
          <p className="g-note">
            Need muscle fast? Hire additional Thugs directly into your empire.
          </p>
          <p className="g-shop-owned">
            Price: <GameValue>${THUG_HIRE_PRICE.toLocaleString()} each</GameValue>
          </p>
          <p className="g-shop-owned">
            Current Thugs: <GameValue>{inventory.thugs.toLocaleString()}</GameValue>
          </p>
          <div className="g-shop-controls">
            <NumericInput
              id="hire-thugs-qty"
              label="Quantity of Thugs to hire"
              value={hireQtyRaw}
              onChange={(raw) => setHireQtyRaw(raw)}
              className="g-shop-qty"
            />
            {hireTotal !== null && (
              <span className="g-shop-total">Total: ${hireTotal.toLocaleString()}</span>
            )}
            <PrimaryButton
              icon="thugs"
              onClick={handleHireThugs}
              disabled={loading === 'hire-thugs' || cannotAffordHire || hireQty === null}
              pending={loading === 'hire-thugs'}
            >
              {loading === 'hire-thugs' ? ACTION_PENDING.shopPurchase : 'Hire Thugs'}
            </PrimaryButton>
          </div>
          {cannotAffordHire && <p className="g-error">Not enough cash.</p>}
        </div>
      ) : isCrewTab && mode === 'sell' ? (
        <div className="g-shop-row">
          <p className="g-section-label">RELEASE THUGS</p>
          <p className="g-note">
            Cut loose excess muscle for cash. Released Thugs leave your crew immediately.
          </p>
          <p className="g-shop-owned">
            Payout: <GameValue>${THUG_SELL_PRICE.toLocaleString()} each</GameValue>
          </p>
          <p className="g-shop-owned">
            Current Thugs: <GameValue>{inventory.thugs.toLocaleString()}</GameValue>
          </p>
          {inventory.thugs <= 0 ? (
            <p className="g-note">You have no Thugs to release.</p>
          ) : (
            <div className="g-shop-controls">
              <NumericInput
                id="sell-thugs-qty"
                label="Quantity of Thugs to release"
                value={sellThugsQtyRaw}
                onChange={(raw) => setSellThugsQtyRaw(raw)}
                className="g-shop-qty"
              />
              {sellThugsTotal !== null && (
                <span className="g-shop-total">You receive: ${sellThugsTotal.toLocaleString()}</span>
              )}
              <PrimaryButton
                icon="thugs"
                onClick={handleSellThugs}
                disabled={
                  loading === 'sell-thugs' ||
                  cannotSellThugs ||
                  sellThugsQty === null
                }
                pending={loading === 'sell-thugs'}
              >
                {loading === 'sell-thugs' ? ACTION_PENDING.shopSell : 'Release Thugs'}
              </PrimaryButton>
            </div>
          )}
          {cannotSellThugs && inventory.thugs > 0 && (
            <p className="g-error">You don&apos;t own that many Thugs.</p>
          )}
        </div>
      ) : (
        items.map((entry) => {
        const qty = parsedQty(entry.key);
        const price = unitPrice(entry);
        const total = qty ? shopPreviewTotal(price, qty) : null;
        const owned = ownedCount(entry);
        const cannotAfford = mode === 'buy' && total !== null && total > cash;
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
            <div className="g-shop-controls">
              <NumericInput
                id={`qty-${entry.key}`}
                label={`Quantity of ${entry.displayName}`}
                value={quantities[entry.key] ?? '1'}
                onChange={(raw) =>
                  setQuantities((prev) => ({ ...prev, [entry.key]: raw }))
                }
                className="g-shop-qty"
              />
              {total !== null && (
                <span className="g-shop-total">
                  {mode === 'buy' ? 'Total' : 'You receive'}: ${total.toLocaleString()}
                </span>
              )}
              {mode === 'buy' ? (
                <PrimaryButton
                  icon="shop"
                  onClick={() => handleBuy(entry)}
                  disabled={loading === entry.key || cannotAfford || qty === null}
                  pending={loading === entry.key}
                >
                  {loading === entry.key ? ACTION_PENDING.shopPurchase : 'Buy'}
                </PrimaryButton>
              ) : (
                <PrimaryButton
                  onClick={() => handleSell(entry)}
                  disabled={
                    loading === entry.key ||
                    qty === null ||
                    (qty !== null && qty > owned)
                  }
                  pending={loading === entry.key}
                >
                  {loading === entry.key ? ACTION_PENDING.shopSell : `Sell ${entry.displayName}`}
                </PrimaryButton>
              )}
            </div>
            {cannotAfford && <p className="g-error">Not enough cash.</p>}
          </div>
        );
      })
      )}

      {!isCrewTab && mode === 'sell' && items.every((entry) => ownedCount(entry) <= 0) && (
        <p className="g-note">Nothing to sell in this category.</p>
      )}
    </>
  );
}
