'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { v4 as uuidv4 } from 'uuid';
import { ACTION_PENDING } from '@local/lib/loading-copy';
import {
  shopPurchaseAction,
  type ShopCatalogEntry,
  type ShopPageData,
} from '@local/server/actions/shop.actions';
import { NumericInput } from '@local/components/game/NumericInput';
import { PrimaryButton } from '@local/components/game/PrimaryButton';
import { ActionResult } from '@local/components/game/ActionResult';
import { GameValue } from '@local/components/game/GameValue';
import { GameIcon } from '@local/components/game/GameIcon';
import { OLDSKOOL_SHOP_TABS, type OldSkoolShopTab } from '@local/config/shop-display';
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

export function ShopForm({
  catalog,
  cash: initialCash,
  inventory: initialInventory,
  initialTab = 'weapons',
  highlightItem = null,
}: ShopFormProps) {
  const router = useRouter();
  const highlightRef = useRef<HTMLDivElement | null>(null);
  const [cash, setCash] = useState(initialCash);
  const [inventory, setInventory] = useState(initialInventory);
  const [quantities, setQuantities] = useState<Record<string, string>>({});
  const [tab, setTab] = useState<OldSkoolShopTab>(initialTab);
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [result, setResult] = useState<{ name: string; qty: number; cost: number } | null>(null);

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
    setResult({ name: entry.displayName, qty: quantity!, cost: response.data.totalCost });
    router.refresh();
  }

  if (result) {
    return (
      <ActionResult
        title="Purchase Complete"
        lines={[
          { text: `${result.qty}× ${result.name}`, tone: 'positive' },
          { text: `$${result.cost.toLocaleString()} spent`, tone: 'value' },
          { text: `$${cash.toLocaleString()} cash remaining`, tone: 'value' },
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

  return (
    <>
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
        const total = qty ? shopPreviewTotal(entry.unitPrice, qty) : null;
        const cannotAfford = total !== null && total > cash;

        return (
          <div
            key={entry.key}
            ref={highlightItem === entry.key ? highlightRef : undefined}
            className={`g-shop-row${highlightItem === entry.key ? ' g-shop-row-highlight' : ''}`}
          >
            <div className="g-shop-head">
              <span className="g-label">{entry.displayName}</span>
              <GameValue>${entry.unitPrice.toLocaleString()} each</GameValue>
            </div>
            <p className="g-shop-owned">
              Owned: <GameValue>{ownedCount(entry).toLocaleString()}</GameValue>
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
                <span className="g-shop-total">Total: ${total.toLocaleString()}</span>
              )}
              <PrimaryButton
                icon="shop"
                onClick={() => handleBuy(entry)}
                disabled={loading === entry.key || cannotAfford || qty === null}
                pending={loading === entry.key}
              >
                {loading === entry.key ? ACTION_PENDING.shopPurchase : 'Buy'}
              </PrimaryButton>
            </div>
            {cannotAfford && <p className="g-error">Not enough cash.</p>}
          </div>
        );
      })}
    </>
  );
}
