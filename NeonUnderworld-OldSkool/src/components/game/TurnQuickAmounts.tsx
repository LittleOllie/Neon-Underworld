'use client';

import { TURNS_CONFIG } from '@core/config/game/balance';

const QUICK_AMOUNTS = TURNS_CONFIG.suggestedAmounts;

export function TurnQuickAmounts({
  value,
  onSelect,
  ariaLabel = 'Quick turn amounts',
}: {
  value: number;
  onSelect: (amount: number) => void;
  ariaLabel?: string;
}) {
  return (
    <div className="g-turn-quick" role="group" aria-label={ariaLabel}>
      {QUICK_AMOUNTS.map((amount) => (
        <button
          key={amount}
          type="button"
          className={`g-turn-quick-btn${value === amount ? ' g-turn-quick-btn-active' : ''}`}
          aria-pressed={value === amount}
          onClick={() => onSelect(amount)}
        >
          {amount}
        </button>
      ))}
    </div>
  );
}

export { QUICK_AMOUNTS as TURN_QUICK_AMOUNTS };
