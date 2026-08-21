'use client';

import { useEffect } from 'react';
import { PrimaryButton } from '@local/components/game/PrimaryButton';
import { NumericInput } from '@local/components/game/NumericInput';
import type { ShopCartLineKey } from '@core/server/actions/shop.actions';
import {
  formatSupplyOrderSummary,
  type SupplyOrderCatalogPrice,
  type SupplyOrderLine,
} from './supply-order';

type SupplyOrderReviewProps = {
  lines: SupplyOrderLine[];
  catalogPrices: SupplyOrderCatalogPrice[];
  cash: number;
  estimatedTotal: number;
  totalUnits: number;
  locked: boolean;
  checkoutPending: boolean;
  error: string;
  onClose: () => void;
  onClear: () => void;
  onUpdateQuantity: (itemId: ShopCartLineKey, quantity: number) => void;
  onRemoveLine: (itemId: ShopCartLineKey) => void;
  onCheckout: () => void;
};

export function SupplyOrderReview({
  lines,
  catalogPrices,
  cash,
  estimatedTotal,
  totalUnits,
  locked,
  checkoutPending,
  error,
  onClose,
  onClear,
  onUpdateQuantity,
  onRemoveLine,
  onCheckout,
}: SupplyOrderReviewProps) {
  const summary = formatSupplyOrderSummary(lines, catalogPrices);
  const cashAfter = cash - estimatedTotal;
  const cannotAfford = estimatedTotal > cash;

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  return (
    <div className="g-supply-review" role="dialog" aria-labelledby="supply-order-title">
      <div className="g-supply-review__panel">
        <div className="g-supply-review__head">
          <h2 id="supply-order-title" className="g-section-label">
            SUPPLY ORDER
          </h2>
          <button type="button" className="g-btn g-btn-secondary g-supply-review__close" onClick={onClose} disabled={locked}>
            Close
          </button>
        </div>

        <ul className="g-supply-review__lines">
          {summary.map((line) => (
            <li key={line.itemId} className="g-supply-review__line">
              <div className="g-supply-review__line-main">
                <span className="g-label">
                  {line.displayName} × {line.quantity.toLocaleString()}
                </span>
                <span className="g-shop-total">${line.lineTotal.toLocaleString()}</span>
              </div>
              <div className="g-supply-review__line-actions">
                <NumericInput
                  id={`order-qty-${line.itemId}`}
                  label={`Quantity of ${line.displayName}`}
                  value={String(line.quantity)}
                  onChange={(raw) => {
                    const trimmed = raw.trim();
                    if (!trimmed || !/^\d+$/.test(trimmed)) return;
                    onUpdateQuantity(line.itemId, Number(trimmed));
                  }}
                  className="g-shop-qty g-supply-review__qty"
                  disabled={locked}
                />
                <button
                  type="button"
                  className="g-btn g-btn-secondary"
                  onClick={() => onRemoveLine(line.itemId)}
                  disabled={locked}
                >
                  Remove
                </button>
              </div>
            </li>
          ))}
        </ul>

        <dl className="g-supply-review__totals">
          <div>
            <dt>Total item types</dt>
            <dd>{summary.length.toLocaleString()}</dd>
          </div>
          <div>
            <dt>Total units</dt>
            <dd>{totalUnits.toLocaleString()}</dd>
          </div>
          <div>
            <dt>Total cost</dt>
            <dd>${estimatedTotal.toLocaleString()}</dd>
          </div>
          <div>
            <dt>Cash available</dt>
            <dd>${cash.toLocaleString()}</dd>
          </div>
          <div>
            <dt>Cash after</dt>
            <dd className={cannotAfford ? 'g-error' : undefined}>${cashAfter.toLocaleString()}</dd>
          </div>
        </dl>

        {error ? <p className="g-error">{error}</p> : null}
        {cannotAfford ? (
          <p className="g-error">
            Your order costs ${estimatedTotal.toLocaleString()}. You currently have ${cash.toLocaleString()}.
          </p>
        ) : null}

        <div className="g-supply-review__actions">
          <PrimaryButton
            icon="shop"
            onClick={onCheckout}
            disabled={locked || cannotAfford || lines.length === 0}
            pending={checkoutPending}
          >
            {checkoutPending ? 'PROCESSING ORDER…' : 'BUY EVERYTHING'}
          </PrimaryButton>
          <button type="button" className="g-btn g-btn-secondary" onClick={onClose} disabled={locked}>
            Edit
          </button>
          <button type="button" className="g-btn g-btn-secondary" onClick={onClear} disabled={locked}>
            Clear order
          </button>
        </div>
      </div>
    </div>
  );
}
