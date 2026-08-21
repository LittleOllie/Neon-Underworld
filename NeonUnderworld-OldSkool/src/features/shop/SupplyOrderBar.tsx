'use client';

type SupplyOrderBarProps = {
  itemTypeCount: number;
  estimatedTotal: number;
  locked: boolean;
  onReview: () => void;
  variant?: 'inline' | 'global';
};

export function SupplyOrderBar({
  itemTypeCount,
  estimatedTotal,
  locked,
  onReview,
  variant = 'inline',
}: SupplyOrderBarProps) {
  return (
    <div
      className={`g-supply-bar${variant === 'global' ? ' g-supply-bar--global' : ''}`}
      aria-live="polite"
    >
      <div className="g-supply-bar__copy">
        <span className="g-section-label">SUPPLY ORDER</span>
        <span className="g-supply-bar__meta">
          {itemTypeCount.toLocaleString()} item{itemTypeCount === 1 ? '' : 's'} · ${estimatedTotal.toLocaleString()}
        </span>
      </div>
      <button type="button" className="g-btn-review" onClick={onReview} disabled={locked}>
        Review
      </button>
    </div>
  );
}
