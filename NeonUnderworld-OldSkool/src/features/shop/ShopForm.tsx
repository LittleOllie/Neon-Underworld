'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { v4 as uuidv4 } from 'uuid';
import { ACTION_PENDING } from '@local/lib/loading-copy';
import {
  shopPurchaseAction,
  shopSellAction,
  streetDrugSaleAction,
  type ShopCatalogEntry,
  type ShopPageData,
} from '@local/server/actions/shop.actions';
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
  mode: ShopMode;
  name: string;
  qty: number;
  amount: number;
};

export function ShopForm({
  catalog,
  cash: initialCash,
  inventory: initialInventory,
  streetDrugPrices,
  initialTab = 'weapons',
  highlightItem = null,
}: ShopFormProps) {
  const router = useRouter();
  const highlightRef = useRef<HTMLDivElement | null>(null);
  const [cash, setCash] = useState(initialCash);
  const [inventory, setInventory] = useState(initialInventory);
  const [quantities, setQuantities] = useState<Record<string, string>>({});
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
    router.refresh();
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
    router.refresh();
  }

  if (result) {
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

      {mode === 'sell' && (
        <p className="g-note">Sell items back at a discounted rate (70% of buy price).</p>
      )}

      <div className="g-filter-row">
        {OLDSKOOL_SHOP_TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            className={`g-filter${tab === t.id ? ' g-filter-active' : ''}`}
            onClick={() => setTab(t.id)}
          >
            <span className="g-nav-link-inner">
              <GameIcon name={t.icon} size={16} />
              <span>{t.label}</span>
            </span>
          </button>
        ))}
      </div>

      {error && <p className="g-error">{error}</p>}

      {items.map((entry) => {
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
      })}

      {mode === 'sell' && items.every((entry) => ownedCount(entry) <= 0) && (
        <p className="g-note">Nothing to sell in this category.</p>
      )}
    </>
  );
}
