'use client';

import type { ReactNode } from 'react';
import { TURNS_CONFIG } from '@core/config/game/balance';

const QUICK_AMOUNTS = TURNS_CONFIG.suggestedAmounts;

function TurnQuickButton({
  amount,
  value,
  disabled,
  onSelect,
}: {
  amount: number;
  value: number;
  disabled: boolean;
  onSelect: (amount: number) => void;
}) {
  return (
    <button
      type="button"
      className={`g-turn-quick-btn${value === amount ? ' g-turn-quick-btn-active' : ''}`}
      aria-pressed={value === amount}
      disabled={disabled}
      onClick={() => onSelect(amount)}
    >
      {amount}
    </button>
  );
}

export function TurnQuickAmounts({
  value,
  onSelect,
  middleSlot,
  ariaLabel = 'Quick turn amounts',
  disabled = false,
}: {
  value: number;
  onSelect: (amount: number) => void;
  /** Optional control rendered after presets with 250 swapped into the centre slot. */
  middleSlot?: ReactNode;
  ariaLabel?: string;
  disabled?: boolean;
}) {
  const leading = QUICK_AMOUNTS.slice(0, 2);
  const trailing = QUICK_AMOUNTS.slice(2, 3);
  const centrePreset = QUICK_AMOUNTS[3];

  return (
    <div className="g-turn-quick" role="group" aria-label={ariaLabel}>
      {leading.map((amount) => (
        <TurnQuickButton
          key={amount}
          amount={amount}
          value={value}
          disabled={disabled}
          onSelect={onSelect}
        />
      ))}
      {centrePreset != null ? (
        <TurnQuickButton
          key={centrePreset}
          amount={centrePreset}
          value={value}
          disabled={disabled}
          onSelect={onSelect}
        />
      ) : null}
      {trailing.map((amount) => (
        <TurnQuickButton
          key={amount}
          amount={amount}
          value={value}
          disabled={disabled}
          onSelect={onSelect}
        />
      ))}
      {middleSlot}
    </div>
  );
}

export { QUICK_AMOUNTS as TURN_QUICK_AMOUNTS };
