'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { v4 as uuidv4 } from 'uuid';
import { ACTION_PENDING } from '@local/lib/loading-copy';
import { homeShopSellAction } from '@local/server/actions/home-shop.actions';
import type { HomeShopDrugEntry, HomeShopPageData } from '@local/lib/home-shop-data';
import { parsePositiveInteger, validateQuantity } from '@local/lib/numeric-input';
import { PrimaryButton } from '@local/components/game/PrimaryButton';
import { ActionResult } from '@local/components/game/ActionResult';
import { SectionLabel } from '@local/components/game/SectionLabel';

type SellResult = {
  drugKey: string;
  drugName: string;
  quantity: number;
  payout: number;
  cash: number;
  newOwned: number;
};

function DrugSellRow({
  drug,
  onSold,
}: {
  drug: HomeShopDrugEntry;
  onSold: (result: SellResult) => void;
}) {
  const router = useRouter();
  const [quantity, setQuantity] = useState('100');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const parsed = parsePositiveInteger(quantity);
  const payout = parsed ? drug.unitPrice * parsed : 0;
  const canSell = drug.owned > 0 && parsed !== null && parsed <= drug.owned;

  function setQty(next: number) {
    const clamped = Math.max(1, Math.min(drug.owned, next));
    setQuantity(String(clamped));
    setError('');
  }

  function applyFraction(fraction: number) {
    if (drug.owned <= 0) return;
    setQty(Math.max(1, Math.floor(drug.owned * fraction)));
  }

  async function handleSell() {
    if (drug.owned <= 0) {
      setError(`You have no ${drug.displayName} to sell.`);
      return;
    }
    const validationError = validateQuantity(parsed);
    if (validationError) {
      setError('Enter an amount to sell.');
      return;
    }
    if (parsed! > drug.owned) {
      setError(`You don't own enough ${drug.displayName}.`);
      return;
    }

    setLoading(true);
    setError('');
    const response = await homeShopSellAction(drug.key, parsed!, uuidv4());
    setLoading(false);

    if (!response.success) {
      setError(response.error);
      return;
    }

    onSold({
      drugKey: drug.key,
      drugName: drug.displayName,
      quantity: response.data.quantity,
      payout: response.data.totalPayout,
      cash: response.data.newCash,
      newOwned: response.data.newOwnedQuantity,
    });
    router.refresh();
  }

  if (drug.owned <= 0) {
    return (
      <div className="g-home-shop-row g-home-shop-row--empty">
        <div className="g-home-shop-row__head">
          <span className="g-home-shop-row__name">{drug.displayName.toUpperCase()}</span>
          <span className="g-home-shop-row__owned">Owned: 0</span>
        </div>
        <p className="g-note">You have no {drug.displayName} to sell.</p>
      </div>
    );
  }

  return (
    <div className="g-home-shop-row">
      <div className="g-home-shop-row__head">
        <span className="g-home-shop-row__name">{drug.displayName.toUpperCase()}</span>
        <span className="g-home-shop-row__owned">Owned: {drug.owned.toLocaleString()}</span>
      </div>
      <p className="g-home-shop-row__price">Sell: ${drug.unitPrice.toLocaleString()} each</p>

      <div className="g-home-shop-qty">
        <button
          type="button"
          className="g-home-shop-qty-btn"
          disabled={loading}
          onClick={() => setQty((parsed ?? 1) - 1)}
          aria-label={`Decrease ${drug.displayName} quantity`}
        >
          −
        </button>
        <input
          className="g-home-shop-qty-field"
          type="number"
          inputMode="numeric"
          min={1}
          max={drug.owned}
          value={quantity}
          disabled={loading}
          onChange={(e) => {
            setQuantity(e.target.value);
            setError('');
          }}
        />
        <button
          type="button"
          className="g-home-shop-qty-btn"
          disabled={loading}
          onClick={() => setQty((parsed ?? 0) + 1)}
          aria-label={`Increase ${drug.displayName} quantity`}
        >
          +
        </button>
      </div>

      <div className="g-home-shop-presets">
        <button type="button" disabled={loading} onClick={() => applyFraction(0.25)}>
          25%
        </button>
        <button type="button" disabled={loading} onClick={() => applyFraction(0.5)}>
          50%
        </button>
        <button type="button" disabled={loading} onClick={() => setQty(drug.owned)}>
          MAX
        </button>
      </div>

      <div className="g-home-shop-receive">
        <span className="g-home-shop-receive__label">You receive</span>
        <span className="g-home-shop-receive__value">${payout.toLocaleString()}</span>
      </div>

      {error && <p className="g-note g-note-error">{error}</p>}

      <PrimaryButton
        disabled={loading || !canSell}
        pending={loading}
        onClick={handleSell}
      >
        {loading ? ACTION_PENDING.homeShopSell : `Sell ${drug.displayName}`}
      </PrimaryButton>
    </div>
  );
}

export function HomeShopPanel({ drugs, cash: initialCash }: HomeShopPageData) {
  const [cash, setCash] = useState(initialCash);
  const [inventory, setInventory] = useState(drugs);
  const [result, setResult] = useState<SellResult | null>(null);

  function handleSold(sellResult: SellResult) {
    setCash(sellResult.cash);
    setInventory((prev) =>
      prev.map((d) =>
        d.key === sellResult.drugKey ? { ...d, owned: sellResult.newOwned } : d,
      ),
    );
    setResult(sellResult);
  }

  if (result) {
    return (
      <ActionResult
        title="Sold"
        lines={[
          { text: `${result.quantity.toLocaleString()} ${result.drugName}`, tone: 'positive' },
          { text: `+$${result.payout.toLocaleString()} CASH`, tone: 'value' },
          { text: `$${result.cash.toLocaleString()} cash on hand`, tone: 'value' },
        ]}
        actions={[
          {
            label: 'Sell More',
            primary: true,
            icon: 'home',
            onClick: () => setResult(null),
          },
        ]}
      />
    );
  }

  const hasAnyDrugs = inventory.some((d) => d.owned > 0);

  return (
    <section className="g-home-shop" aria-label="Home shop">
      <SectionLabel>HOME SHOP</SectionLabel>
      <p className="g-note">Sell drugs instantly for cash. Not the player Market.</p>
      <p className="g-home-shop-cash">Cash: ${cash.toLocaleString()}</p>

      {!hasAnyDrugs && (
        <p className="g-note">No drugs in inventory. Produce or scout to stock up.</p>
      )}

      {inventory.map((drug) => (
        <DrugSellRow key={drug.key} drug={drug} onSold={handleSold} />
      ))}
    </section>
  );
}
